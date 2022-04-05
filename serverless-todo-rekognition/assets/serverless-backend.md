# Step 1: Build the API and the Database

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
[database-construct.ts](lib/database-construct.ts)
<details>
  <summary>Source code</summary>

```typescript
import {Construct} from "constructs";
import {AttributeType, BillingMode, Table} from "aws-cdk-lib/aws-dynamodb";
import {RemovalPolicy} from "aws-cdk-lib";

export class Database extends Construct {
  public readonly table: Table;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.table = new Table(this, 'table', {
      partitionKey: {name: 'user', type: AttributeType.STRING},
      sortKey: {name: 'id', type: AttributeType.STRING},
      billingMode: BillingMode.PAY_PER_REQUEST,
      // removalPolicy: RemovalPolicy.DESTROY
    });
  }
}
```
</details>

### Add the Database construct to the CDK stack
[serverless-todo-rekognition-stack.ts](lib/serverless-todo-rekognition-stack.ts)
<details>
  <summary>Source code</summary>

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
</details>

## Create an API Gateway 

### What is API Gateway?
Amazon API Gateway is a fully managed service that makes it easy for developers to create, publish, maintain, monitor, and secure APIs at any scale.

### Create an API construct
[api-construct.ts](lib/api-construct.ts)

<details>
  <summary>Source code</summary>

```typescript
import {Construct} from "constructs";
import {Cors, RestApi } from "aws-cdk-lib/aws-apigateway";

export class API extends Construct {
  public readonly api: RestApi;
  
  constructor(scope: Construct, id: string) {
    super(scope, id);
    this.api = new RestApi(this, 'tasks', {
      restApiName: 'serverless-todo-rekognition',
      defaultCorsPreflightOptions: {
        allowCredentials: true,
        allowOrigins: Cors.ALL_ORIGINS,
      },
    });
  }
}
```
</details>


### Add API Construct to Root Stack
[serverless-todo-rekognition-stack.ts](lib/serverless-todo-rekognition-stack.ts)

<details>
  <summary>Source code</summary>

```typescript
import {Stack, StackProps} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {Database} from "./database-construct";
import {API} from "./api-construct";

export class TestStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    new Database(this, 'task')
    new API(this, 'api')
  }
}

```
</details>

### Create API routes
```
POST
/tasks
/token

GET
/tasks
/tasks/{id}
/signedUrl

DELETE
/tasks/{id}
```

#### Task resources
[api-construct.ts](lib/api-construct.ts)

<details>
  <summary>Source code</summary>

```typescript
import {Construct} from "constructs";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";
import {Cors, LambdaIntegration, RestApi, TokenAuthorizer} from "aws-cdk-lib/aws-apigateway";

export class API extends Construct {
  public createTaskFn: NodejsFunction;
  public getTaskFn: NodejsFunction;
  public getTasksFn: NodejsFunction;
  public getTokenFn: NodejsFunction;
  public deleteTaskFn: NodejsFunction;
  public getSignedUrlFn: NodejsFunction;
  public readonly api: RestApi;
  private tokenAuthorizer: TokenAuthorizer;

  constructor(scope: Construct, id: string) {
    super(scope, id);
    this.api = new RestApi(this, 'tasks', {
      restApiName: 'serverless-todo-rekognition',
      defaultCorsPreflightOptions: {
        allowCredentials: true,
        allowOrigins: Cors.ALL_ORIGINS,
      },
    });
    this.addTaskResources()
  }

  private addTaskResources() {
    const tasks = this.api.root.addResource('tasks')
    const task = tasks.addResource('{id}')
    const props = {
      authorizer: this.tokenAuthorizer
    }

    tasks.addMethod('POST', new LambdaIntegration(this.createTaskFn), props)
    tasks.addMethod('GET', new LambdaIntegration(this.getTasksFn), props)
    task.addMethod('GET', new LambdaIntegration(this.getTaskFn), props)
    task.addMethod('DELETE', new LambdaIntegration(this.deleteTaskFn), props)
  }
}
```
</details>

#### Root resources
[api-construct.ts](lib/api-construct.ts)
<details>
  <summary>Source code</summary>

```typescript
import {Construct} from "constructs";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";
import {Cors, LambdaIntegration, RestApi, TokenAuthorizer} from "aws-cdk-lib/aws-apigateway";

export class API extends Construct {
  public createTaskFn: NodejsFunction;
  public getTaskFn: NodejsFunction;
  public getTasksFn: NodejsFunction;
  public getTokenFn: NodejsFunction;
  public deleteTaskFn: NodejsFunction;
  public getSignedUrlFn: NodejsFunction;
  public readonly api: RestApi;
  private tokenAuthorizer: TokenAuthorizer;

  constructor(scope: Construct, id: string) {
    super(scope, id);
    this.api = new RestApi(this, 'tasks', {
      restApiName: 'serverless-todo-rekognition',
      defaultCorsPreflightOptions: {
        allowCredentials: true,
        allowOrigins: Cors.ALL_ORIGINS,
      },
    });
    this.addTaskResources()
    this.addRootResources()
  }

  private addTaskResources() {
    const tasks = this.api.root.addResource('tasks')
    const task = tasks.addResource('{id}')
    const props = {
      authorizer: this.tokenAuthorizer
    }

    tasks.addMethod('POST', new LambdaIntegration(this.createTaskFn), props)
    tasks.addMethod('GET', new LambdaIntegration(this.getTasksFn), props)
    task.addMethod('GET', new LambdaIntegration(this.getTaskFn), props)
    task.addMethod('DELETE', new LambdaIntegration(this.deleteTaskFn), props)
  }

  private addRootResources() {
    const token = this.api.root.addResource('token')
    const signedUrl = this.api.root.addResource('signedUrl')
    const props = {
      authorizer: this.tokenAuthorizer
    }

    token.addMethod('POST', new LambdaIntegration(this.getTokenFn))
    signedUrl.addMethod('GET', new LambdaIntegration(this.getSignedUrlFn), props)
  }
}
```
</details>

[api-construct.ts](lib/api-construct.ts)

### Add Lambda Functions as API Method Integration

#### What is AWS Lambda?
AWS Lambda is a serverless compute service that lets you run code without provisioning or managing servers. Lambda automatically allocates compute power and runs your code based on the incoming request or event, for any scale of traffic.

How it works:

1. Upload your code to AWS Lambda or write code in Lambda's code editor. (In this workshop, we'll be writing code and uploading it using CDK.)
2. Set up your code to trigger from other AWS services, HTTP endpoints, or in-app activity.
3. Lambda runs your code only when triggered, using only the compute resources needed.
4. Just pay for the compute time you use.

[api-construct.ts](lib/api-construct.ts)

<details>
  <summary>Source code</summary>

```typescript
import {Construct} from "constructs";
import {NodejsFunction, NodejsFunctionProps} from "aws-cdk-lib/aws-lambda-nodejs";
import {Cors, LambdaIntegration, RestApi, TokenAuthorizer} from "aws-cdk-lib/aws-apigateway";
import {Duration} from "aws-cdk-lib";
import {RetentionDays} from "aws-cdk-lib/aws-logs";

export class API extends Construct {
    public createTaskFn: NodejsFunction;
    public getTaskFn: NodejsFunction;
    public getTasksFn: NodejsFunction;
    public getTokenFn: NodejsFunction;
    public deleteTaskFn: NodejsFunction;
    public getSignedUrlFn: NodejsFunction;
    public authorizerFn: NodejsFunction;
    public readonly api: RestApi;
    private tokenAuthorizer: TokenAuthorizer;

    constructor(scope: Construct, id: string) {
        super(scope, id);
        this.api = new RestApi(this, 'tasks', {
            restApiName: 'serverless-todo-rekognition',
            defaultCorsPreflightOptions: {
                allowCredentials: true,
                allowOrigins: Cors.ALL_ORIGINS,
            },
        });
        this.createLambdaFunctions()
        this.addTaskResources()
        this.addRootResources()
    }

    private createLambda(id: string, props?: NodejsFunctionProps) {
        const defaultProps: NodejsFunctionProps = {
            entry: `src/lambda/${id}/index.ts`,
            handler: 'handler',
            bundling: {
                externalModules: [
                    'aws-sdk'
                ],
            },
            timeout: Duration.seconds(30),
            logRetention: RetentionDays.THREE_DAYS,
            ...props
        }
        return new NodejsFunction(this, id, defaultProps);
    }

    private createLambdaFunctions() {
        this.authorizerFn = this.createLambda('authorizer')
        this.getTokenFn = this.createLambda('get-token')
        this.createTaskFn = this.createLambda('create-task')
        this.getTaskFn = this.createLambda('get-task')
        this.getTasksFn = this.createLambda('get-tasks')
        this.deleteTaskFn = this.createLambda('delete-task')
        this.getSignedUrlFn = this.createLambda('get-signed-url')
        this.tokenAuthorizer = new TokenAuthorizer(this, 'task-authorizer', {
            handler: this.authorizerFn,
        });
    }

    private addTaskResources() {
        const tasks = this.api.root.addResource('tasks')
        const task = tasks.addResource('{id}')
        const props = {
            authorizer: this.tokenAuthorizer
        }

        tasks.addMethod('POST', new LambdaIntegration(this.createTaskFn), props)
        tasks.addMethod('GET', new LambdaIntegration(this.getTasksFn), props)
        task.addMethod('GET', new LambdaIntegration(this.getTaskFn), props)
        task.addMethod('DELETE', new LambdaIntegration(this.deleteTaskFn), props)
    }

    private addRootResources() {
        const token = this.api.root.addResource('token')
        const signedUrl = this.api.root.addResource('signedUrl')
        const props = {
            authorizer: this.tokenAuthorizer
        }

        token.addMethod('POST', new LambdaIntegration(this.getTokenFn))
        signedUrl.addMethod('GET', new LambdaIntegration(this.getSignedUrlFn), props)
    }
}
```
</details>


### Refactor API Construct to include external properties
[api-construct.ts](lib/api-construct.ts)
<details>
  <summary>Source code</summary>

```typescript
import {Construct} from "constructs";
import {NodejsFunction, NodejsFunctionProps} from "aws-cdk-lib/aws-lambda-nodejs";
import {Cors, LambdaIntegration, RestApi, TokenAuthorizer} from "aws-cdk-lib/aws-apigateway";
import {Duration} from "aws-cdk-lib";
import {RetentionDays} from "aws-cdk-lib/aws-logs";

interface ConstructProps {
    tasks_table: string;
    region: string;
    secret: string;
}

interface Props {
    default: NodejsFunctionProps;
    auth: NodejsFunctionProps;
}

export class API extends Construct {
    public createTaskFn: NodejsFunction;
    public getTaskFn: NodejsFunction;
    public getTasksFn: NodejsFunction;
    public getTokenFn: NodejsFunction;
    public deleteTaskFn: NodejsFunction;
    public getSignedUrlFn: NodejsFunction;
    public authorizerFn: NodejsFunction;
    public readonly api: RestApi;
    private tokenAuthorizer: TokenAuthorizer;
    private readonly props: Props;

    constructor(scope: Construct, id: string, props: ConstructProps) {
        super(scope, id);
        this.api = new RestApi(this, 'tasks', {
            restApiName: 'serverless-todo-rekognition',
            defaultCorsPreflightOptions: {
                allowCredentials: true,
                allowOrigins: Cors.ALL_ORIGINS,
            },
        });
        this.props = {
            default: {
                environment: {
                    TASKS_TABLE: props.tasks_table,
                    REGION: props.region,
                }
            },
            auth: {
                environment: {
                    SECRET: props.secret
                }
            }
        }
        this.createLambdaFunctions()
        this.addTaskResources()
        this.addRootResources()
    }

    private createLambda(id: string, props?: NodejsFunctionProps) {
        const defaultProps: NodejsFunctionProps = {
            entry: `src/lambda/${id}/index.ts`,
            handler: 'handler',
            bundling: {
                externalModules: [
                    'aws-sdk'
                ],
            },
            timeout: Duration.seconds(30),
            logRetention: RetentionDays.THREE_DAYS,
            ...props
        }
        return new NodejsFunction(this, id, defaultProps);
    }

    private createLambdaFunctions() {
        this.authorizerFn = this.createLambda('authorizer', this.getProps('auth'))
        this.getTokenFn = this.createLambda('get-token', this.getProps('auth'))
        this.createTaskFn = this.createLambda('create-task', this.getProps())
        this.getTaskFn = this.createLambda('get-task', this.getProps())
        this.getTasksFn = this.createLambda('get-tasks', this.getProps())
        this.deleteTaskFn = this.createLambda('delete-task', this.getProps())
        this.getSignedUrlFn = this.createLambda('get-signed-url', this.getProps())
        this.tokenAuthorizer = new TokenAuthorizer(this, 'task-authorizer', {
            handler: this.authorizerFn,
        });
    }

    private addTaskResources() {
        const tasks = this.api.root.addResource('tasks')
        const task = tasks.addResource('{id}')
        const props = {
            authorizer: this.tokenAuthorizer
        }

        tasks.addMethod('POST', new LambdaIntegration(this.createTaskFn), props)
        tasks.addMethod('GET', new LambdaIntegration(this.getTasksFn), props)
        task.addMethod('GET', new LambdaIntegration(this.getTaskFn), props)
        task.addMethod('DELETE', new LambdaIntegration(this.deleteTaskFn), props)
    }

    private addRootResources() {
        const token = this.api.root.addResource('token')
        const signedUrl = this.api.root.addResource('signedUrl')
        const props = {
            authorizer: this.tokenAuthorizer
        }

        token.addMethod('POST', new LambdaIntegration(this.getTokenFn))
        signedUrl.addMethod('GET', new LambdaIntegration(this.getSignedUrlFn), props)
    }

    private getProps(key: string = 'default'): NodejsFunctionProps {
        return this.props[key as keyof Props];
    }
}
```
</details>

### Add properties to API Construct
[serverless-todo-rekognition-stack.ts](lib/serverless-todo-rekognition-stack.ts)

<details>
  <summary>Source code</summary>

````typescript
import {Stack, StackProps} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {Database} from "./database-construct";
import {API} from "./api-construct";

export class TestStack extends Stack {
    private readonly db: Database;
    private readonly api: API;

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        new Database(this, 'task')
        new API(this, 'api', {
            tasks_table: this.db.table.tableName,
            region: 'us-west-2',
            secret: 'secret',
        })
    }
}
````
</details>

### Add Permissions
[serverless-todo-rekognition-stack.ts](lib/serverless-todo-rekognition-stack.ts)

<details>
  <summary>Source code</summary>

```typescript
import {Stack, StackProps} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {Database} from "./database-construct";
import {API} from "./api-construct";

export class TestStack extends Stack {
    private readonly db: Database;
    private readonly api: API;

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        this.db = new Database(this, 'task')
        this.api = new API(this, 'api', {
            tasks_table: this.db.table.tableName,
            region: 'us-west-2',
            secret: 'secret',
        })
        this.configure()
    }

    private configure() {
        this.db.table.grantWriteData(this.api.createTaskFn)
        this.db.table.grantReadData(this.api.getTaskFn)
        this.db.table.grantReadData(this.api.getTasksFn)
        this.db.table.grantReadWriteData(this.api.deleteTaskFn)
    }
}
```

</details>

# Step 2: Implement the Rekognition Label Detection API

### Create a storage bucket
[storage-construct.ts](lib/storage-construct.ts)

<details>
  <summary>Source code</summary>

```typescript
import {Construct} from "constructs";
import {Bucket, BucketEncryption, HttpMethods} from "aws-cdk-lib/aws-s3";
import {RemovalPolicy} from "aws-cdk-lib";

interface Props {
    uid: string;
}

export class Storage extends Construct {
    public bucket: Bucket;

    constructor(scope: Construct, id: string, props: Props) {
        super(scope, id);

        this.bucket = new Bucket(this, 'bucket', {
            bucketName: `workshop-todo-rekognition-${props.uid}`,
            encryption: BucketEncryption.S3_MANAGED,
            cors: [{
                allowedHeaders: ['*'],
                allowedMethods: [HttpMethods.GET, HttpMethods.PUT, HttpMethods.HEAD],
                allowedOrigins: ['*']
            }],
            removalPolicy: RemovalPolicy.DESTROY // Change to retain in production if needed
        })
    }
}
```

</details>

### Instantiate the Storage Construct within the Root Stack
[serverless-todo-rekognition-stack.ts](lib/serverless-todo-rekognition-stack.ts)

<details>
  <summary>Source code</summary>

```typescript
import {Fn, Stack, StackProps} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {Database} from "./database-construct";
import {API} from "./api-construct";
import {Storage} from "./storage-construct";

export class TestStack extends Stack {
    private readonly db: Database;
    private readonly api: API;
    private readonly storage: Storage;

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        this.db = new Database(this, 'task')
        this.storage = new Storage(this, 'storage', {
            uid: Fn.select(0, Fn.split('-', Fn.select(2, Fn.split('/', this.stackId))))
        });
        this.api = new API(this, 'api', {
            tasks_table: this.db.table.tableName,
            region: 'us-west-2',
            secret: 'secret',
        })
        this.configure()
    }

    private configure() {
        this.db.table.grantWriteData(this.api.createTaskFn)
        this.db.table.grantReadData(this.api.getTaskFn)
        this.db.table.grantReadData(this.api.getTasksFn)
        this.db.table.grantReadWriteData(this.api.deleteTaskFn)
    }
}
```
</details>

### Create the Detect Label Lambda Function
[api-construct.ts](lib/api-construct.ts)

<details>
  <summary>Source code</summary>

```typescript
import {Construct} from "constructs";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";
import {Cors, Deployment, LambdaIntegration, RestApi, TokenAuthorizer} from "aws-cdk-lib/aws-apigateway";
import {NodejsFunctionProps} from "aws-cdk-lib/aws-lambda-nodejs/lib/function";
import {RetentionDays} from "aws-cdk-lib/aws-logs";
import {Duration} from "aws-cdk-lib";
import {PolicyStatement} from "aws-cdk-lib/aws-iam";

interface ConstructProps {
    tasks_table: string;
    region: string;
    secret: string;
    uploadBucket: string;
}

interface Props {
    default: NodejsFunctionProps;
    auth: NodejsFunctionProps;
}

export class API extends Construct {
    public createTaskFn: NodejsFunction;
    public getTaskFn: NodejsFunction;
    public getTasksFn: NodejsFunction;
    public getTokenFn: NodejsFunction;
    public deleteTaskFn: NodejsFunction;
    public getSignedUrlFn: NodejsFunction;
    public detectLabelsFn: NodejsFunction;
    public authorizerFn: NodejsFunction;
    public readonly api: RestApi;
    private tokenAuthorizer: TokenAuthorizer;
    private readonly props: Props;

    constructor(scope: Construct, id: string, props: ConstructProps) {
        super(scope, id);
        this.api = new RestApi(this, 'tasks', {
            restApiName: 'serverless-todo-rekognition',
            defaultCorsPreflightOptions: {
                allowCredentials: true,
                allowOrigins: Cors.ALL_ORIGINS,
            },
        });
        this.props = {
            default: {
                environment: {
                    TASKS_TABLE: props.tasks_table,
                    REGION: props.region,
                    S3_BUCKET: props.uploadBucket
                }
            },
            auth: {
                environment: {
                    SECRET: props.secret
                }
            }
        }
        this.createLambdaFunctions()
        this.addCustomPolicies()
        this.addTaskResources()
        this.addRootResources()
        new Deployment(this, 'Deployment', {api: this.api});
    }

    private createLambda(id: string, props?: NodejsFunctionProps) {
        const defaultProps: NodejsFunctionProps = {
            entry: `src/lambda/${id}/index.ts`,
            handler: 'handler',
            bundling: {
                externalModules: [
                    'aws-sdk'
                ],
            },
            timeout: Duration.seconds(30),
            logRetention: RetentionDays.THREE_DAYS,
            ...props
        }
        return new NodejsFunction(this, id, defaultProps);
    }

    private createLambdaFunctions() {
        this.authorizerFn = this.createLambda('authorizer', this.getProps('auth'))
        this.getTokenFn = this.createLambda('get-token', this.getProps('auth'))
        this.createTaskFn = this.createLambda('create-task', this.getProps())
        this.getTaskFn = this.createLambda('get-task', this.getProps())
        this.getTasksFn = this.createLambda('get-tasks', this.getProps())
        this.deleteTaskFn = this.createLambda('delete-task', this.getProps())
        this.getSignedUrlFn = this.createLambda('get-signed-url', this.getProps())
        this.detectLabelsFn = this.createLambda('detect-labels', this.getProps())
        this.tokenAuthorizer = new TokenAuthorizer(this, 'task-authorizer', {
            handler: this.authorizerFn,
        });
    }

    private addCustomPolicies() {
        const rekognitionDetectOnlyPolicy = new PolicyStatement({
            actions: ["rekognition:DetectFaces",
                "rekognition:DetectLabels",
                "rekognition:DetectModerationLabels",
                "rekognition:DetectText"],
            resources: ['*'],
        });
        this.detectLabelsFn.addToRolePolicy(rekognitionDetectOnlyPolicy)
    }

    private addTaskResources() {
        const tasks = this.api.root.addResource('tasks')
        const task = tasks.addResource('{id}')
        const props = {
            authorizer: this.tokenAuthorizer
        }

        tasks.addMethod('POST', new LambdaIntegration(this.createTaskFn), props)
        tasks.addMethod('GET', new LambdaIntegration(this.getTasksFn), props)
        task.addMethod('GET', new LambdaIntegration(this.getTaskFn), props)
        task.addMethod('DELETE', new LambdaIntegration(this.deleteTaskFn), props)
    }

    private addRootResources() {
        const token = this.api.root.addResource('token')
        const signedUrl = this.api.root.addResource('signedUrl')
        const props = {
            authorizer: this.tokenAuthorizer
        }

        token.addMethod('POST', new LambdaIntegration(this.getTokenFn))
        signedUrl.addMethod('GET', new LambdaIntegration(this.getSignedUrlFn), props)
    }

    private getProps(key: string = 'default'): NodejsFunctionProps {
        return this.props[key as keyof Props];
    }
}
```

</details>

### Refactor the Root Stack
[serverless-todo-rekognition-stack.ts](lib/serverless-todo-rekognition-stack.ts)

<details>
  <summary>Source code</summary>

````typescript
import {Fn, Stack, StackProps} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {Database} from "./database-construct";
import {API} from "./api-construct";
import {Storage} from "./storage-construct";
import {EventType} from "aws-cdk-lib/aws-s3";
import {LambdaDestination} from "aws-cdk-lib/aws-s3-notifications";

export class ServerlessTodoRekognitionStack extends Stack {
    private readonly db: Database;
    private readonly api: API;
    private readonly storage: Storage;

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        this.db = new Database(this, 'task')
        this.storage = new Storage(this, 'storage', {
            uid: Fn.select(0, Fn.split('-', Fn.select(2, Fn.split('/', this.stackId))))
        });
        this.api = new API(this, 'api', {
            tasks_table: this.db.table.tableName,
            region: 'us-west-2',
            secret: 'secret',
            uploadBucket: this.storage.bucket.bucketName
        })
        this.configure()
    }

    private configure() {
        this.db.table.grantReadWriteData(this.api.createTaskFn)
        this.db.table.grantReadData(this.api.getTaskFn)
        this.db.table.grantReadData(this.api.getTasksFn)
        this.db.table.grantReadWriteData(this.api.deleteTaskFn)
        this.db.table.grantReadWriteData(this.api.detectLabelsFn);
        this.storage.bucket.grantWrite(this.api.getSignedUrlFn);
        this.storage.bucket.grantRead(this.api.detectLabelsFn);
        this.storage.bucket.addEventNotification(EventType.OBJECT_CREATED, new LambdaDestination(this.api.detectLabelsFn));
    }
}

````
