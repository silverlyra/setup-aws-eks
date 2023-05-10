import {spawn} from 'child_process'

import * as core from '@actions/core'

async function run(): Promise<void> {
  const name = core.getInput('cluster', {required: true})
  const context = core.getInput('context') || name
  const role = core.getInput('role') || undefined
  const activate = core.getBooleanInput('activate')
  const allowError = core.getBooleanInput('allow-error')

  const env = role ? await assumeRole(role) : undefined

  const cluster = await describeCluster(name, env)
  if (cluster != null) {
    core.info(
      `Configuring context ${context} for cluster ${cluster.name} ` +
        `(${cluster.version}.${cluster.platformVersion}, ${cluster.status})`
    )
  }

  if (core.isDebug()) {
    await configureCluster(true)
  }

  try {
    await configureCluster()
  } catch (err) {
    core.error('aws eks update-kubeconfig failed')
    if (!allowError) throw err
  }

  core.setOutput('context', context)

  if (activate) {
    try {
      core.info(await exec(['kubectl', 'config', 'use-context', context]))
    } catch (err) {
      core.error('kubectl config use-context failed')
      throw err
    }
  }

  if (core.isDebug()) {
    await exec(['kubectl', 'config', 'view'])
  }

  async function configureCluster(dryRun = false): Promise<void> {
    return updateKubeconfig(cluster?.name ?? name, context, role, env, dryRun)
  }
}

async function updateKubeconfig(
  name: string,
  context: string | undefined,
  role: string | undefined,
  env: Environment | undefined,
  dryRun = false
): Promise<void> {
  core.info(
    await exec(
      [
        'aws',
        'eks',
        'update-kubeconfig',
        ...['--name', name],
        ...(context ? ['--alias', context] : []),
        ...(role ? ['--role-arn', role] : []),
        ...(dryRun ? ['--dry-run'] : [])
      ],
      env
    )
  )
}

async function describeCluster(
  name: string,
  env: Environment | undefined
): Promise<Cluster | null> {
  let cluster: Cluster

  try {
    cluster = JSON.parse(
      await exec(['aws', 'eks', 'describe-cluster', '--name', name], env)
    ).cluster
  } catch (err) {
    core.warning(
      `Failed to describe EKS cluster ${JSON.stringify(name)}: ${err}`
    )
    return null
  }

  core.setOutput('cluster_name', cluster.name)
  core.setOutput('cluster_arn', cluster.arn)
  core.setOutput('cluster_status', cluster.status)
  core.setOutput('cluster_endpoint', cluster.endpoint)
  core.setOutput('cluster_tags', JSON.stringify(cluster.tags ?? {}))
  core.setOutput('kubernetes_version', cluster.version)
  core.setOutput('platform_version', cluster.platformVersion)
  if (cluster.certificateAuthority?.data)
    core.setOutput(
      'certificate_authority',
      Buffer.from(cluster.certificateAuthority.data, 'base64').toString('utf-8')
    )

  return cluster
}

interface Cluster {
  name: string
  arn: string
  createdAt: string
  version: string
  platformVersion: string
  endpoint: string
  status: string
  certificateAuthority?: {data: string}
  tags: Record<string, string>
}

type Environment = Record<string, string>

async function exec(command: string[], env?: Environment): Promise<string> {
  const proc = spawn(command[0], command.slice(1), {
    stdio: ['ignore', 'pipe', 'inherit'],
    env: env ? {...process.env, ...env} : undefined
  })

  return new Promise<string>((resolve, reject) => {
    const output: string[] = []

    proc.once('error', reject)

    proc.stdout.on('data', data => {
      output.push(data.toString('utf-8'))
    })

    proc.once('close', (status, signal) => {
      if (signal != null) {
        reject(new Error(`${command[0]} process exited from signal ${signal}`))
      } else if (status != null && status !== 0) {
        reject(new Error(`${command[0]} process exited with status ${status}`))
      } else {
        resolve(output.join(''))
      }
    })
  })
}

async function assumeRole(arn: string): Promise<Environment> {
  core.info(`Assuming AWS IAM role ${arn}`)

  const output = await exec([
    'aws',
    'sts',
    'assume-role',
    '--role-arn',
    arn,
    '--role-session-name',
    'setup-aws-eks'
  ])
  const role: AssumedRole = JSON.parse(output)

  const {
    Credentials: {AccessKeyId: id, SecretAccessKey: secret, SessionToken: token}
  } = role

  return {
    AWS_ACCESS_KEY_ID: id,
    AWS_SECRET_ACCESS_KEY: secret,
    AWS_SESSION_TOKEN: token
  }
}

interface AssumedRole {
  Credentials: Credentials
}

interface Credentials {
  AccessKeyId: string
  SecretAccessKey: string
  SessionToken: string
}

run().catch(core.setFailed)
