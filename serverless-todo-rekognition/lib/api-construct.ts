import {Construct} from "constructs";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";
import {
    Cors,
    Deployment,
    IdentitySource,
    LambdaIntegration,
    RequestAuthorizer,
    RestApi
} from "aws-cdk-lib/aws-apigateway";
import {CfnOutput} from "aws-cdk-lib";

export class API extends Construct {
    public readonly createTaskLambda: NodejsFunction;
    public readonly api: RestApi;
    private readonly authorizer: NodejsFunction;
    private lambdaEnvironment: { [key: string]: string }

    constructor(scope: Construct, id: string) {
        super(scope, id);
        this.api = new RestApi(this, 'tasks', {
            restApiName: 'serverless-todo-rekognition',
            defaultCorsPreflightOptions: {
                allowCredentials: true,
                allowOrigins: Cors.ALL_ORIGINS,
            },
        });
        this.authorizer = this.createLambda('authorizer', 'authorizer/index.ts')
        this.createTaskLambda = this.createLambda('create-task', 'create-task/index.ts')
        this.addTaskResources()
        new Deployment(this, 'Deployment', {api: this.api});
        new CfnOutput(this, 'endpoint', {value: this.api.url})
    }

    public setEnvironment(obj: { [key: string]: string }) {
        this.lambdaEnvironment = {
            ...this.lambdaEnvironment,
            ...obj
        }
    }

    private createLambda(id: string, entry: string) {
        const props = {
            entry: `src/lambda/${entry}`,
            handler: 'handler',
            bundling: {
                externalModules: [
                    'aws-sdk'
                ],
            },
            environment: {...this.lambdaEnvironment}
        }
        return new NodejsFunction(this, id, props);
    }

    private addTaskResources() {
        const tasks = this.api.root.addResource('tasks')
        const task = tasks.addResource('{id}')

        const auth = new RequestAuthorizer(this, 'booksAuthorizer', {
            handler: this.authorizer,
            identitySources: [IdentitySource.header('Authorization')]
        });

        tasks.addMethod('POST', new LambdaIntegration(this.createTaskLambda), {
            authorizer: auth
        })
        task.addMethod('GET', new LambdaIntegration(this.createTaskLambda))
        task.addMethod('DELETE', new LambdaIntegration(this.createTaskLambda))
    }
}
