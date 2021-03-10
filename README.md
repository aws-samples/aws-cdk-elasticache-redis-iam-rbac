# Managing ElastiCache Redis access with Redis RBAC, AWS SecretsManager and AWS IAM

This project demonstrates how to manage access to ElastiCache Redis by storing Redis RBAC username and passwords in AWS Secrets Manager. Granting or denying access to the secret will by proxy grant or deny access to Redis via RBAC.

This project creates an ElastiCache Redis Replication group, IAM roles, Lambdas, Secrets and ElastiCache RBAC users and user groups.

Details on the architecture can be found [here](docs/architecture.md)

## Installing CDK

This project uses the AWS Cloud Development Kit (CDK). You can find instructions on installing CDK [here](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html#getting_started_install)

## How to build and deploy

1. Run `npm install` to install the node dependencies for the project
1. You may need to run `cdk bootstrap aws://<account_id>/<region>` to initialize the region to use CDK
1. Build the zip files which contain lambda functions by calling `npm run-script zip`
1. Deploy the project by calling `cdk deploy`

## Useful commands

- `npm run-script zip` bundle lambda functions into zip files
- `npm run build` compile typescript to js
- `npm run watch` watch for changes and compile
- `npm run test` perform the jest unit tests
- `cdk deploy` deploy this stack to your default AWS account/region
- `cdk diff` compare deployed stack with current state
- `cdk synth` emits the synthesized CloudFormation template

## License

This library is licensed under the MIT-0 License. See the [LICENSE](/architecture.md) file.
