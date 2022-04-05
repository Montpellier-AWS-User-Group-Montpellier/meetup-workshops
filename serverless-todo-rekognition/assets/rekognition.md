
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
