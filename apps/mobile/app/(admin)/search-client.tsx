import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../src/store/auth.store'

const API_URL = 'http://192.168.0.107:3000/api'

interface Client {
  id: string
  name: string
  lastName: string
  idNumber: string
  phone: string
  email: string
  address: string
}

export default function SearchClientScreen() {
  const router = useRouter()
  const { token } = useAuthStore()

  // ── Estado búsqueda ──────────────────────────────────────────────
  const [idNumber, setIdNumber] = useState('')
  const [searching, setSearching] = useState(false)
  const [client, setClient] = useState<Client | null>(null)
  const [notFound, setNotFound] = useState(false)

  // ── Estado formulario registro ───────────────────────────────────
  const [form, setForm] = useState({
    name: '',
    lastName: '',
    phone: '',
    email: '',
    address: '',
  })
  const [saving, setSaving] = useState(false)

  // ── Buscar cliente por cédula ────────────────────────────────────
  const handleSearch = async () => {
    if (!idNumber.trim()) {
      Alert.alert('Error', 'Ingresa el número de cédula')
      return
    }

    setSearching(true)
    setClient(null)
    setNotFound(false)

    try {
      const res = await fetch(`${API_URL}/clients/idnumber/${idNumber.trim()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()

      if (res.ok && data.success) {
        setClient(data.data)
      } else {
        setNotFound(true)
      }
    } catch {
      Alert.alert('Error', 'No se pudo conectar al servidor')
    } finally {
      setSearching(false)
    }
  }

  // ── Registrar cliente nuevo ──────────────────────────────────────
  const handleRegister = async () => {
    if (!form.name || !form.lastName || !form.phone) {
      Alert.alert('Error', 'Nombre, apellido y teléfono son obligatorios')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/clients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...form, idNumber: idNumber.trim() }),
      })
      const data = await res.json()

      if (res.ok && data.success) {
        setClient(data.data)
        setNotFound(false)
        Alert.alert('✅ Éxito', 'Cliente registrado correctamente')
      } else {
        Alert.alert('Error', data.message || 'No se pudo registrar el cliente')
      }
    } catch {
      Alert.alert('Error', 'No se pudo conectar al servidor')
    } finally {
      setSaving(false)
    }
  }

  // ── Continuar a crear orden ──────────────────────────────────────
  const handleContinue = () => {
    router.push({
      pathname: '/(admin)/create-order',
      params: { clientId: client!.id, clientName: `${client!.name} ${client!.lastName}` },
    })
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">

        {/* ── Encabezado ── */}
        <View style={styles.header}>
          <Text style={styles.title}>Buscar Cliente</Text>
          <Text style={styles.subtitle}>Ingresa la cédula para buscar o registrar</Text>
        </View>

        {/* ── Buscador ── */}
        <View style={styles.searchBox}>
          <TextInput
            style={styles.input}
            placeholder="Número de cédula"
            keyboardType="numeric"
            value={idNumber}
            onChangeText={setIdNumber}
            onSubmitEditing={handleSearch}
          />
          <TouchableOpacity
            style={styles.btnSearch}
            onPress={handleSearch}
            disabled={searching}
          >
            {searching
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Buscar</Text>
            }
          </TouchableOpacity>
        </View>

        {/* ── Cliente encontrado ── */}
        {client && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>✅ Cliente encontrado</Text>
            <Text style={styles.cardRow}><Text style={styles.label}>Nombre: </Text>{client.name} {client.lastName}</Text>
            <Text style={styles.cardRow}><Text style={styles.label}>Cédula: </Text>{client.idNumber}</Text>
            <Text style={styles.cardRow}><Text style={styles.label}>Teléfono: </Text>{client.phone}</Text>
            <Text style={styles.cardRow}><Text style={styles.label}>Email: </Text>{client.email}</Text>
            <Text style={styles.cardRow}><Text style={styles.label}>Dirección: </Text>{client.address}</Text>

            <TouchableOpacity style={styles.btnContinue} onPress={handleContinue}>
              <Text style={styles.btnText}>Continuar → Crear Orden</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Cliente no encontrado → Formulario ── */}
        {notFound && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>⚠️ Cliente no encontrado</Text>
            <Text style={styles.cardSubtitle}>Registra al cliente nuevo</Text>

            <TextInput style={styles.input} placeholder="Nombre *" value={form.name}
              onChangeText={v => setForm({ ...form, name: v })} />
            <TextInput style={styles.input} placeholder="Apellido *" value={form.lastName}
              onChangeText={v => setForm({ ...form, lastName: v })} />
            <TextInput style={styles.input} placeholder="Teléfono * (ej: 04121234567)" value={form.phone}
              keyboardType="phone-pad" onChangeText={v => setForm({ ...form, phone: v })} />
            <TextInput style={styles.input} placeholder="Email" value={form.email}
              keyboardType="email-address" onChangeText={v => setForm({ ...form, email: v })} />
            <TextInput style={styles.input} placeholder="Dirección" value={form.address}
              onChangeText={v => setForm({ ...form, address: v })} />

            <TouchableOpacity style={styles.btnSave} onPress={handleRegister} disabled={saving}>
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Registrar Cliente</Text>
              }
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f5f5f5' },
  header:      { backgroundColor: '#1a73e8', padding: 24, paddingTop: 48 },
  title:       { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  subtitle:    { fontSize: 14, color: '#c8e0ff', marginTop: 4 },
  searchBox:   { flexDirection: 'row', padding: 16, gap: 8 },
  input:       { flex: 1, backgroundColor: '#fff', borderRadius: 8, padding: 12,
                 fontSize: 16, borderWidth: 1, borderColor: '#ddd', marginBottom: 8 },
  btnSearch:   { backgroundColor: '#1a73e8', borderRadius: 8, paddingHorizontal: 16,
                 justifyContent: 'center' },
  btnContinue: { backgroundColor: '#34a853', borderRadius: 8, padding: 14,
                 alignItems: 'center', marginTop: 12 },
  btnSave:     { backgroundColor: '#1a73e8', borderRadius: 8, padding: 14,
                 alignItems: 'center', marginTop: 8 },
  btnText:     { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  card:        { margin: 16, backgroundColor: '#fff', borderRadius: 12, padding: 16,
                 elevation: 2 },
  cardTitle:   { fontSize: 18, fontWeight: 'bold', marginBottom: 8, color: '#333' },
  cardSubtitle:{ fontSize: 14, color: '#666', marginBottom: 12 },
  cardRow:     { fontSize: 15, marginBottom: 4, color: '#444' },
  label:       { fontWeight: 'bold', color: '#333' },
})