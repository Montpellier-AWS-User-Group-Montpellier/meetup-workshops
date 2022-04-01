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
