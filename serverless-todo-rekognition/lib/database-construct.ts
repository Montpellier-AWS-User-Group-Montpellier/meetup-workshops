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
