# Step 1: Build a serverless backend: AWS Lambda, AWS CDK

### Before starting the workshop...

We assume you already have:

- an AWS account configured
- the AWS CLI installed
- your AWS credentials configured

---

### What is the AWS CDK

The AWS CDK lets you build reliable, scalable, cost-effective applications in the cloud with the considerable expressive
power of a programming language. This approach yields many benefits, including:

- Build with high-level constructs that automatically provide sensible, secure defaults for your AWS resources, defining
  more infrastructure with less code.
- Use programming idioms like parameters, conditionals, loops, composition, and inheritance to model your system design
  from building blocks provided by AWS and others.
- Put your infrastructure, application code, and configuration all in one place, ensuring that at every milestone you
  have a complete, cloud-deployable system.
- Employ software engineering practices such as code reviews, unit tests, and source control to make your infrastructure
  more robust.
- Connect your AWS resources together (even across stacks) and grant permissions using simple, intent-oriented APIs.
- Import existing AWS CloudFormation templates to give your resources a CDK API.
- Use the power of AWS CloudFormation to perform infrastructure deployments predictably and repeatedly, with rollback on
  error.
- Easily share infrastructure design patterns among teams within your organization or even with the public.

![CDK](https://docs.aws.amazon.com/cdk/v2/guide/images/AppStacks.png)

#### What will we build with the AWS CDK ?

In this section, you will complete your first CDK deployment which will build much of the backend infrastructure which
we will add to through the rest of the workshop.

#### What are serverless applications?

Serverless applications are applications composed of functions triggered by events. A typical serverless application
consists of one or more AWS Lambda functions triggered by events such as object uploads to Amazon S3, Amazon SNS
notifications, and API actions. Those functions can stand alone or leverage other resources such as Amazon DynamoDB
tables or S3 buckets. The most basic serverless application is simply a function.

## Define a DynamoDB table

### What is Amazon DynamoDB?
Amazon DynamoDB  is a serverless key-value and document database that delivers single-digit millisecond performance at any scale.

Similar to other database systems, Amazon DynamoDB stores data in tables. In our sample application, we will store information about our tasks in a DynamoDB table. This table will be accessed by a Lambda function, in response to API calls from the web application.

We can define a DynamoDB table using the AWS CDK.

### Create a Database construct
`database-construct.ts`
```typescript
import * as dynamodb from "aws-cdk-lib/aws-dynamodb"
import {BillingMode} from "aws-cdk-lib/aws-dynamodb"
import {Construct} from "constructs";

export class Database extends Construct {
    public readonly table: dynamodb.Table;

    constructor(scope: Construct, id: string, props?: {}) {
        super(scope, id);

        this.table = new dynamodb.Table(this, 'table', {
            partitionKey: {name: 'user', type: dynamodb.AttributeType.STRING},
            sortKey: {name: 'id', type: dynamodb.AttributeType.STRING},
            billingMode: BillingMode.PAY_PER_REQUEST
        });
    }
}
```
### Add the Database construct to the CDK stack
`serverless-todo-rekognition-stack.ts`
```typescript
import {Stack, StackProps} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {Database} from "./database-construct";

export class ServerlessTodoRekognitionStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        // The code that defines your stack goes here

        new Database(this, 'task')
    }
}
```

## Create a Lambda function

### What is AWS Lambda?
AWS Lambda is a serverless compute service that lets you run code without provisioning or managing servers. Lambda automatically allocates compute power and runs your code based on the incoming request or event, for any scale of traffic.

How it works:

1. Upload your code to AWS Lambda or write code in Lambda's code editor. (In this workshop, we'll be writing code and uploading it using SAM.)
2. Set up your code to trigger from other AWS services, HTTP endpoints, or in-app activity.
3. Lambda runs your code only when triggered, using only the compute resources needed.
4. Just pay for the compute time you use.

