import * as jwt from 'njwt'

enum Effect {
    ALLOW = "Allow",
    DENY = "Deny"
}

exports.handler = function (event: any) {
    console.info('received:', JSON.stringify(event, null, 2))
    const [_, token] = event.headers["Authorization"].split(' ')

    try {
        const verifiedJwt = jwt.verify(token, process.env.SECRET);
        console.log(`Verified token: ${verifiedJwt}`)
        const resource = `${event.methodArn.split('/', 2).join('/')}/*`
        // @ts-ignore
        const policy = generatePolicy(verifiedJwt.body.sub, Effect.ALLOW, resource)
        console.log(`Generated policy: ${JSON.stringify(policy)}`)
        return policy;
    } catch (e) {
        console.log(e);
        return "Unauthorized"
    }
}

const generatePolicy = (principalId: string, effect: Effect, resource: string) => {
    return {
        principalId,
        policyDocument: {
            Version: '2012-10-17',
            Statement: [
                {
                    Action: 'execute-api:Invoke',
                    Effect: effect,
                    Resource: resource
                }
            ]
        },
        context: {
            userId: 1,
            createdAt: new Date().toISOString()
        }
    }
}
