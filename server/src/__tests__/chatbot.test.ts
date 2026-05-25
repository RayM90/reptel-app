import request from 'supertest'
import app from '../app'

// Mock del SDK de AWS Lex para evitar llamadas reales durante tests
jest.mock('@aws-sdk/client-lex-runtime-v2', () => ({
  LexRuntimeV2Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({
      messages: [{ content: '¿Cuál es el número de tu orden?' }],
      sessionState: {
        intent: {
          name: 'ConsultarOrden',
          slots: {},
        },
      },
    }),
  })),
  RecognizeTextCommand: jest.fn(),
}))

describe('Chatbot — POST /api/chatbot/message', () => {

  it('debe retornar 200 con mensaje válido', async () => {
    const res = await request(app)
      .post('/api/chatbot/message')
      .send({
        sessionId: `test-${Date.now()}`,
        message: 'Quiero saber el estado de mi reparación',
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body).toHaveProperty('response')
    expect(res.body).toHaveProperty('intent')
  }, 15000)

  it('debe retornar 200 con intent ConsultarOrden', async () => {
    const res = await request(app)
      .post('/api/chatbot/message')
      .send({
        sessionId: `test-${Date.now()}`,
        message: 'Como va mi celular',
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.intent).toBe('ConsultarOrden')
  }, 15000)

  it('debe retornar 400 si falta sessionId', async () => {
    const res = await request(app)
      .post('/api/chatbot/message')
      .send({ message: 'Hola' })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('debe retornar 400 si falta message', async () => {
    const res = await request(app)
      .post('/api/chatbot/message')
      .send({ sessionId: 'test-123' })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('debe retornar 400 si el body está vacío', async () => {
    const res = await request(app)
      .post('/api/chatbot/message')
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

})