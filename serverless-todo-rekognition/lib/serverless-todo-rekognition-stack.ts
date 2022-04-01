import {Stack, StackProps} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {Database} from "./database-construct";
import {API} from "./api-construct";

export class ServerlessTodoRekognitionStack extends Stack {
    private readonly db: Database;
    private readonly api: API;

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        // The code that defines your stack goes here

        this.db = new Database(this, 'task')
        this.api = new API(this, 'api')
        this.configure()
    }

    private configure() {
        this.api.setEnvironment({
            TASKS_TABLE: this.db.table.tableName,
            REGION: 'us-west-2'
        })
        this.db.table.grantReadWriteData(this.api.createTaskLambda)
    }
}
