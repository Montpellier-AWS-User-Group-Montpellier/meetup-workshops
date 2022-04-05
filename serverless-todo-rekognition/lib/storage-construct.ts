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
