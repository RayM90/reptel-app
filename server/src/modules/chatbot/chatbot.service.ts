import {
  LexRuntimeV2Client,
  RecognizeTextCommand,
} from '@aws-sdk/client-lex-runtime-v2'
import prisma from '../../lib/prisma'

const lexClient = new LexRuntimeV2Client({ region: process.env.AWS_REGION || 'us-east-1' })

export const sendMessageToLex = async (sessionId: string, message: string) => {
  const command = new RecognizeTextCommand({
    botId: process.env.LEX_BOT_ID!,
    botAliasId: process.env.LEX_BOT_ALIAS_ID!,
    localeId: process.env.LEX_LOCALE_ID || 'es_ES',
    sessionId,
    text: message,
  })

  const response = await lexClient.send(command)

  const intent = response.sessionState?.intent?.name
  const slots = response.sessionState?.intent?.slots
  const botMessage = response.messages?.map(m => m.content).join(' ') ||
    'No entendí tu mensaje, ¿puedes reformularlo?'

  // Si detectó ConsultarOrden y tiene el número, buscamos en BD
  if (intent === 'ConsultarOrden' && slots?.numeroOrden?.value?.interpretedValue) {
    const orderInfo = await getOrderStatus(slots.numeroOrden.value.interpretedValue)
    return { response: orderInfo, intent }
  }

  // Si quiere hablar con asesor
  if (intent === 'HablarAsesor') {
    return {
      response: '📞 Te conectaremos con un asesor. Por favor acércate al mostrador o llama al número del local.',
      intent
    }
  }

  // Si consulta precios
  if (intent === 'ConsultarPrecios') {
    return {
      response: '💰 Nuestros precios varían según el equipo y la falla. Te recomendamos traer el equipo para un diagnóstico gratuito. ¡Sin compromiso!',
      intent
    }
  }

  // Si pregunta tiempo de espera
  if (intent === 'TiempoEspera') {
    return {
      response: '⏱ El tiempo de reparación depende de la falla y disponibilidad de repuestos. Generalmente entre 24 y 72 horas. Te notificamos cuando esté listo.',
      intent
    }
  }

  return { response: botMessage, intent }
}

const getOrderStatus = async (orderNumber: string): Promise<string> => {
  try {
    const order = await prisma.order.findFirst({
      where: {
        orderNumber: { contains: orderNumber.toUpperCase() }
      },
      include: {
        client: { select: { name: true } },
        device: true,
        statusHistory: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    })

    if (!order) {
      return `❌ No encontré ninguna orden con el número *${orderNumber}*. Verifica el número e intenta de nuevo.`
    }

    const statusMap: Record<string, string> = {
      RECEIVED:         '📋 Recibido — en espera de diagnóstico',
      DIAGNOSING:       '🔍 En diagnóstico',
      WAITING_APPROVAL: '⏳ Esperando tu aprobación del presupuesto',
      APPROVED:         '✅ Presupuesto aprobado — iniciando reparación',
      REPAIRING:        '🔧 En reparación',
      READY:            '🎉 ¡Listo para retirar!',
      DELIVERED:        '📦 Entregado',
      CANCELLED:        '❌ Cancelado',
    }

    const status = statusMap[order.status] || order.status

    return (
      `📱 *Orden #${order.orderNumber}*\n` +
      `👤 Cliente: ${order.client.name}\n` +
      `📟 Equipo: ${order.device.brand} ${order.device.model}\n` +
      `📌 Estado: ${status}\n` +
      `🕐 Última actualización: ${order.updatedAt.toLocaleDateString('es-VE')}`
    )
  } catch (error) {
    console.error('Error consultando orden:', error)
    return '⚠️ Hubo un error consultando tu orden. Por favor intenta más tarde.'
  }
}