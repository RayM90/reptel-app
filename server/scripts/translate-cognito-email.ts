// Pone en español el correo con el código de verificación / recuperación de
// contraseña que envía Cognito. UpdateUserPool reemplaza la configuración
// completa del User Pool (lo que no se envía vuelve a su valor por defecto),
// así que se copia todo lo actual y solo se cambia el asunto y el mensaje.
//
// Uso (desde server/):
//   npx ts-node scripts/translate-cognito-email.ts --dry-run   (solo muestra)
//   npx ts-node scripts/translate-cognito-email.ts             (aplica)
// Antes de aplicar guarda una copia de la configuración en
// scripts/userpool-backup-<fecha>.json (no se sube a git).
import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import {
  CognitoIdentityProviderClient,
  DescribeUserPoolCommand,
  UpdateUserPoolCommand,
  UpdateUserPoolCommandInput,
} from '@aws-sdk/client-cognito-identity-provider'

const EMAIL_SUBJECT = 'Tu código de RepTel'
const EMAIL_MESSAGE =
  'Hola,<br><br>Tu código de RepTel es: <b>{####}</b><br><br>' +
  'Escríbelo en la app para continuar. Si no lo pediste, ignora este correo.<br><br>— RepTel'

const client = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION })
const UserPoolId = process.env.COGNITO_USER_POOL_ID!
const dryRun = process.argv.includes('--dry-run')

;(async () => {
  const { UserPool: pool } = await client.send(new DescribeUserPoolCommand({ UserPoolId }))
  if (!pool) throw new Error('No se encontró el User Pool')

  const params: UpdateUserPoolCommandInput = {
    UserPoolId,
    Policies: pool.Policies,
    DeletionProtection: pool.DeletionProtection,
    LambdaConfig: pool.LambdaConfig,
    AutoVerifiedAttributes: pool.AutoVerifiedAttributes,
    SmsVerificationMessage: pool.SmsVerificationMessage,
    SmsAuthenticationMessage: pool.SmsAuthenticationMessage,
    UserAttributeUpdateSettings: pool.UserAttributeUpdateSettings,
    MfaConfiguration: pool.MfaConfiguration,
    DeviceConfiguration: pool.DeviceConfiguration,
    EmailConfiguration: pool.EmailConfiguration,
    SmsConfiguration: pool.SmsConfiguration,
    UserPoolTags: pool.UserPoolTags,
    // UnusedAccountValidityDays está obsoleto (lo reemplaza
    // Policies.PasswordPolicy.TemporaryPasswordValidityDays) y no se puede
    // enviar junto con él.
    AdminCreateUserConfig: pool.AdminCreateUserConfig && {
      AllowAdminCreateUserOnly: pool.AdminCreateUserConfig.AllowAdminCreateUserOnly,
      InviteMessageTemplate: pool.AdminCreateUserConfig.InviteMessageTemplate,
    },
    UserPoolAddOns: pool.UserPoolAddOns,
    AccountRecoverySetting: pool.AccountRecoverySetting,
    UserPoolTier: pool.UserPoolTier,
    VerificationMessageTemplate: {
      ...pool.VerificationMessageTemplate,
      DefaultEmailOption: 'CONFIRM_WITH_CODE',
      EmailSubject: EMAIL_SUBJECT,
      EmailMessage: EMAIL_MESSAGE,
    },
  }

  if (dryRun) {
    console.log(JSON.stringify(params, null, 2))
    return
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backup = path.join(__dirname, `userpool-backup-${stamp}.json`)
  fs.writeFileSync(backup, JSON.stringify(pool, null, 2))
  console.log('Copia de la configuración:', backup)

  await client.send(new UpdateUserPoolCommand(params))

  const { UserPool: after } = await client.send(new DescribeUserPoolCommand({ UserPoolId }))
  console.log('Asunto:', after?.VerificationMessageTemplate?.EmailSubject)
  console.log('Política de claves igual:', JSON.stringify(after?.Policies) === JSON.stringify(pool.Policies))
  console.log('Recuperación igual:', JSON.stringify(after?.AccountRecoverySetting) === JSON.stringify(pool.AccountRecoverySetting))
  console.log('Correo igual:', JSON.stringify(after?.EmailConfiguration) === JSON.stringify(pool.EmailConfiguration))
})()
