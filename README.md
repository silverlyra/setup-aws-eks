# setup-aws-eks

[![build-test](https://github.com/silverlyra/setup-aws-eks/actions/workflows/test.yml/badge.svg)](https://github.com/silverlyra/setup-aws-eks/actions/workflows/test.yml)

Use this action to connect to an [AWS EKS][] cluster from a [GitHub Actions][] workflow.

This action will create or update the [`.kube/config`][kubeconfig] file, configuring Kubernetes clients (including the [`kubectl`][kubectl] CLI) to connect to your EKS cluster. It uses the [`update-kubeconfig`][update-kubeconfig] command provided by the AWS CLI.

[AWS EKS]: https://aws.amazon.com/eks/
[GitHub Actions]: https://docs.github.com/en/actions
[kubeconfig]: https://kubernetes.io/docs/tasks/access-application-cluster/configure-access-multiple-clusters/
[kubectl]: https://kubernetes.io/docs/reference/kubectl/
[update-kubeconfig]: https://awscli.amazonaws.com/v2/documentation/api/latest/reference/eks/update-kubeconfig.html

## Usage

See [action.yml](action.yml).

<!-- start usage -->
```yaml
- uses: silverlyra/setup-aws-eks@v0.1
  with:
    # Name of the EKS cluster you want to access (required)
    cluster: ''

    # Name of the Kubernetes config context to create (default: EKS cluster name)
    context: ''

    # ARN of an IAM role to assign to cluster authentication
    role: ''

    # If 'true', the action will run use-context for the cluster's new context
    activate: 'false'
```
<!-- end usage -->

### Example
```yaml
- name: Configure AWS Credentials
  uses: aws-actions/configure-aws-credentials@v2
  with:
    role-to-assume: arn:aws:iam::123456789100:role/my-github-actions-role
    aws-region: us-east-2

- name: Configure Kubernetes client
  uses: silverlyra/setup-aws-eks@v0.1
  with:
    cluster: my-cluster-name

- name: Deploy service
  run: |
    kubectl apply -f ./deployment.yml
    kubectl rollout status -f ./deployment.yml --timeout=15m
```

## Outputs

- **`context`** – The name of the Kubernetes context created
- **`cluster_name`** – The EKS cluster name for which access was configured
- **`cluster_arn`** – The ARN of the EKS cluster
- **`cluster_status`** – The observed `status` of the EKS cluster
- **`cluster_endpoint`** – The `https://` origin of the cluster's API server
- **`cluster_tags`** – The AWS tags applied to the EKS cluster, as a JSON object
- **`kubernetes_version`** – The Kubernetes version of the cluster, e.g., `1.24`