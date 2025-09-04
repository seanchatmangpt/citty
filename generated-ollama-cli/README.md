# kubectl-manage - A CLI Tool for Managing Kubernetes Deployments and Resources

## Overview

**kubectl-manage** is a custom-built command-line interface (CLI) tool designed to simplify the management of Kubernetes deployments, including scaling, logging, deletion, and checking deployment statuses. It leverages your existing `kubectl` commands but provides an intuitive user experience tailored specifically for managing Kubernetes resources.

## Installation Instructions

To install **kubectl-manage**, ensure that you have a working version of Kubernetes installed on your system. Follow the installation instructions provided by [Kubernetes](https://kubernetes.io/docs/tasks/tools/install-kubectl/) or use our pre-built CLI tool if available through your package manager (e.g., `pip` for Python).

```bash
# Example: Install kubectl-manage via pip (Python)
$ python -m pip install kubectl-manage

# Verify the installation
$ kubectl-manage --version
```

## Usage Examples

### Deploy a Deployment

Deploy a new deployment with specified labels and resources.

```bash
kubectl-manage deploy create --name=my-app --image=my-image:1.0 \
  --port=8080 --labels="app=my-app" --replicas=3
```

### Scale the Deployment

Scale an existing deployment to increase or decrease replicas based on specified conditions.

```bash
# Increase replica count by 2
kubectl-manage deploy scale my-app --replicas=$(( $(kubectl get deployments my-app -o jsonpath='{.spec.replicas}') + 2 ))

# Decrease replica count by 1 if it's greater than 0, else do nothing.
if [ $(( $(kubectl get deployments my-app -o jsonpath='{.spec.replicas}') )) -gt 0 ]; then
  kubectl-manage deploy scale my-app --replicas=$(( $(kubectl get deployments my-app -o jsonpath='{.spec.replicas}') - 1 ))
fi
```

### Get Deployment Logs

Get detailed logs from a specific container within the deployment.

```bash
kubectl-manage deploy logs my-app --container=my-container-name
```

### Delete a Deployment

Delete a specified deployment, prompting for confirmation before execution if required.

```bash
kubectl-manage deploy delete my-app
```

### Check Deployment Status

Check the current status of a deployment by retrieving its information.

```bash
kubectl-manage deploy status my-app
```

## Configuration Options

**kubectl-manage** allows customization through environment variables. For example, to override default timeout settings:

```env
KUBECTL_MANAGE_DEFAULT_TIMEOUT=60 s
```

You can also configure custom paths for certain files or directories used internally by the tool.

## OpenTelemetry Integration Details

OpenTelemetry is a unified observability platform that captures and propagates telemetry data from distributed systems, including Kubernetes deployments. To integrate **kubectl-manage** with OpenTelemetry:

1. Ensure you have OpenTelemetry SDK installed and configured in your environment.
2. Use `OTEL_LOGS_EXPORTER=kube-prometheus-stackdriver` to send logs to StackDriver or another supported exporter.

## Troubleshooting Guide

### Command Not Found

If `kubectl-manage` is not recognized, ensure that the installation was successful and verified by running `$ kubectl-manage --version`.

### Missing Dependencies

Check your environment for missing dependencies. Sometimes additional packages may be required depending on how you installed **kubectl-manage**.

### Unknown Commands

Ensure you have the latest version of `kubectl-manage` and run commands within a supported terminal emulator. If using non-standard emulators, consider switching to a more standard one like Terminal or iTerm for better compatibility with Kubernetes CLI tools.

## Contributing Guidelines

Contributions are welcome! Here’s how you can contribute:

1. **Fork the repository**.
2. **Create a feature branch** from `main`.
3. **Submit Pull Requests (PR)** explaining what changes were made and why.

Remember to adhere to our code of conduct, which aims to foster an inclusive environment for all contributors.

## Conclusion

With **kubectl-manage**, managing Kubernetes deployments has never been easier. Its intuitive interface coupled with powerful features makes it a valuable tool in your Kubernetes management toolkit. If you encounter any issues or have suggestions for improvement, don’t hesitate to reach out via our GitHub issue tracker.

Happy deploying!