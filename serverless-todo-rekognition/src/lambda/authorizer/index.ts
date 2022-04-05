import * as jwt from 'njwt'

enum Effect {
    ALLOW = "Allow",
    DENY = "Deny"
}

export const handler = (event: any, context: any, callback: any) => {
    console.info('received:', JSON.stringify(event, null, 2))
    const [_, token] = event.authorizationToken.split(' ')
    const resource = `${event.methodArn.split('/', 2).join('/')}/*`
    try {
        const verifiedJwt = jwt.verify(token, process.env.SECRET);
        console.log(`Verified token: ${verifiedJwt}`)
        // @ts-ignore
        const policy = generatePolicy(verifiedJwt.body.sub, Effect.ALLOW, resource)
        console.log(`Generated policy: ${JSON.stringify(policy)}`)
        callback(null, policy);
    } catch (e) {
        console.error(e)
        callback("Unauthorized")
    }
}

const generatePolicy = (principalId: string, effect: Effect, resource: string) => {
    const policy =  {
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
        }
    }
    if (effect === Effect.DENY)
        return policy
    return {
        ...policy,
        context: {
            userId: 1,
            createdAt: new Date().toISOString()
        }
    }
}
