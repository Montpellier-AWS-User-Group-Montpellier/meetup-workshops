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
