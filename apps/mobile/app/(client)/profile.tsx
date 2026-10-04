import { useCallback, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useFocusEffect } from 'expo-router'
import { clientsAPI } from '../../src/services/api'
import { useAuthStore } from '../../src/store/auth.store'
import { useToastStore } from '../../src/store/toast.store'
import ScreenHeader from '../../src/components/ScreenHeader'
import StickyFooter from '../../src/components/StickyFooter'
import PhoneInput from '../../src/components/PhoneInput'
import AddressFields, { emptyAddressValues, isAddressComplete, AddressValues } from '../../src/components/AddressFields'

const SECONDARY_LABELS = ['Casa', 'Trabajo', 'Otro']

const pickAddress = (a: any): AddressValues => ({
  addressState: a?.addressState ?? '',
  addressCity: a?.addressCity ?? '',
  addressNeighborhood: a?.addressNeighborhood ?? '',
  addressStreet: a?.addressStreet ?? '',
  addressBuilding: a?.addressBuilding ?? '',
})

// Perfil del cliente: se abre en solo lectura; con "Editar mis datos" se
// habilitan nombre, apellido, celular y direcciones. La cédula y el correo se
// muestran pero no se cambian aquí (el correo es su usuario para entrar).
export default function ProfileScreen() {
  const showToast = useToastStore((state) => state.showToast)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [idNumber, setIdNumber] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState<AddressValues>(emptyAddressValues)
  const [hadSecondary, setHadSecondary] = useState(false)
  const [wantsSecondary, setWantsSecondary] = useState(false)
  const [secondaryLabel, setSecondaryLabel] = useState('Casa')
  const [secondaryLabelOther, setSecondaryLabelOther] = useState('')
  const [secondaryAddress, setSecondaryAddress] = useState<AddressValues>(emptyAddressValues)

  const isCompany = /^[JG]-/.test(idNumber)
  const [idLetter, ...idRest] = idNumber.split('-')

  const loadProfile = useCallback(() => {
    setLoading(true)
    setEditing(false)
    clientsAPI
      .getMe()
      .then((res) => {
        const c = res.data.data
        setIdNumber(c.idNumber ?? '')
        setEmail(c.email ?? '')
        setName(c.name ?? '')
        setLastName(c.lastName ?? '')
        setPhone(c.phone ?? '')
        setAddress(pickAddress(c))
        const second = c.secondaryAddress
        setHadSecondary(!!second)
        setWantsSecondary(!!second)
        if (second) {
          const known = SECONDARY_LABELS.includes(second.label)
          setSecondaryLabel(known ? second.label : 'Otro')
          setSecondaryLabelOther(known ? '' : second.label)
          setSecondaryAddress(pickAddress(second))
        }
      })
      .catch((error: any) => showToast(error?.response?.data?.message || 'No se pudo cargar tu perfil', 'error'))
      .finally(() => setLoading(false))
  }, [])

  useFocusEffect(loadProfile)

  const handleSave = async () => {
    if (!name.trim() || (!isCompany && !lastName.trim())) {
      showToast(isCompany ? 'La razón social es requerida' : 'Nombre y apellido son requeridos', 'error')
      return
    }
    if (!phone) {
      showToast('El celular es requerido', 'error')
      return
    }
    if (!isAddressComplete(address)) {
      showToast('La dirección de entrega debe estar completa (los 5 campos)', 'error')
      return
    }
    const label = secondaryLabel === 'Otro' ? secondaryLabelOther.trim() : secondaryLabel
    if (wantsSecondary && (!label || !isAddressComplete(secondaryAddress))) {
      showToast('La segunda dirección debe tener nombre y los 5 campos completos', 'error')
      return
    }

    setSaving(true)
    try {
      await clientsAPI.updateMe({
        name: name.trim(),
        lastName: isCompany ? '' : lastName.trim(),
        phone,
        ...address,
        // undefined: no se toca; null: se quita la que había.
        secondaryAddress: wantsSecondary ? { label, ...secondaryAddress } : hadSecondary ? null : undefined,
      })
      const fullName = [name.trim(), isCompany ? '' : lastName.trim()].filter(Boolean).join(' ')
      useAuthStore.setState((s) => ({ user: s.user ? { ...s.user, name: fullName } : s.user }))
      showToast('✅ Datos actualizados', 'success')
      setHadSecondary(wantsSecondary)
      setEditing(false)
    } catch (error: any) {
      showToast(error?.response?.data?.message || 'No se pudieron guardar tus datos', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <LinearGradient colors={['#ffffff', '#eef2ff', '#d5ddff', '#8fa5ff']} style={{ flex: 1 }}>
          <ScreenHeader backLabel="← Inicio" title="Mi perfil" subtitle="Tus datos de contacto y entrega" />

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color="#17247a" />
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
              <View style={styles.form}>
                <Text style={styles.label}>Cédula / RIF</Text>
                <View style={styles.row}>
                  <View style={[styles.readOnly, styles.idLetter]}>
                    <Text style={styles.readOnlyText}>{idLetter}</Text>
                  </View>
                  <View style={[styles.readOnly, { flex: 1 }]}>
                    <Text style={styles.readOnlyText}>{idRest.join('-')}</Text>
                  </View>
                </View>

                <Text style={styles.label}>Correo electrónico</Text>
                <View style={styles.readOnly}>
                  <Text style={styles.readOnlyText}>{email}</Text>
                </View>
                <Text style={styles.hint}>Para cambiar tu cédula o correo, comunícate con RepTel (Soporte).</Text>

                <Text style={styles.label}>{isCompany ? 'Razón social o nombre de la empresa' : 'Nombre'}</Text>
                <TextInput
                  style={[styles.input, !editing && styles.inputLocked]}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  editable={editing}
                />

                {!isCompany && (
                  <>
                    <Text style={styles.label}>Apellido</Text>
                    <TextInput
                      style={[styles.input, !editing && styles.inputLocked]}
                      value={lastName}
                      onChangeText={setLastName}
                      autoCapitalize="words"
                      editable={editing}
                    />
                  </>
                )}

                <Text style={styles.label}>Celular</Text>
                <PhoneInput value={phone} onChange={setPhone} disabled={!editing} />

                <Text style={styles.sectionTitle}>Dirección de entrega</Text>
                <AddressFields values={address} onChange={setAddress} disabled={!editing} />

                {editing && (
                  <TouchableOpacity style={styles.secondaryToggle} onPress={() => setWantsSecondary((prev) => !prev)}>
                    <Text style={styles.secondaryToggleText}>
                      {wantsSecondary ? '− Quitar segunda dirección' : '+ Agregar otra dirección (opcional)'}
                    </Text>
                  </TouchableOpacity>
                )}

                {wantsSecondary && (
                  <>
                    {!editing && <Text style={styles.sectionTitle}>Otra dirección</Text>}
                    <View style={styles.chipsRow} pointerEvents={editing ? 'auto' : 'none'}>
                      {SECONDARY_LABELS.map((l) => (
                        <TouchableOpacity
                          key={l}
                          style={[styles.labelChip, secondaryLabel === l && styles.labelChipActive]}
                          onPress={() => setSecondaryLabel(l)}
                        >
                          <Text style={[styles.labelChipText, secondaryLabel === l && styles.labelChipTextActive]}>{l}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {secondaryLabel === 'Otro' && (
                      <TextInput
                        style={styles.input}
                        placeholder="Nombre de esta dirección"
                        placeholderTextColor="#9ca3af"
                        value={secondaryLabelOther}
                        onChangeText={setSecondaryLabelOther}
                        editable={editing}
                      />
                    )}
                    <AddressFields values={secondaryAddress} onChange={setSecondaryAddress} disabled={!editing} />
                  </>
                )}
              </View>
            </ScrollView>
          )}

          <StickyFooter>
            {editing ? (
              <View style={styles.footerRow}>
                <TouchableOpacity style={styles.btnCancel} onPress={loadProfile} disabled={saving}>
                  <Text style={styles.btnCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnSave, { flex: 1 }, saving && styles.btnDisabled]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnSaveText}>Guardar cambios</Text>}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.btnSave, loading && styles.btnDisabled]}
                onPress={() => setEditing(true)}
                disabled={loading}
              >
                <Text style={styles.btnSaveText}>✏️ Editar mis datos</Text>
              </TouchableOpacity>
            )}
          </StickyFooter>
        </LinearGradient>
      </KeyboardAvoidingView>
    </>
  )
}

// Mismos estilos de las celdas del registro de la app (register.tsx).
const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 22, paddingBottom: 24 },
  form: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#1a1a6e',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  label: { fontSize: 13, fontWeight: '600', color: '#1a1a6e', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1.5,
    borderColor: '#d0d8ff',
    borderRadius: 12,
    padding: 13,
    fontSize: 15,
    color: '#1a1a6e',
    backgroundColor: '#f0f4ff',
  },
  row: { flexDirection: 'row', gap: 8 },
  readOnly: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  idLetter: { minWidth: 64, alignItems: 'center' },
  readOnlyText: { fontSize: 15, color: '#6B6B75' },
  hint: { fontSize: 11, color: '#7a7aaa', marginTop: 6, lineHeight: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a6e', marginTop: 18, marginBottom: 10 },
  secondaryToggle: { marginTop: 4, marginBottom: 12, minHeight: 44, justifyContent: 'center' },
  secondaryToggleText: { fontSize: 13, fontWeight: '600', color: '#5564ad' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  labelChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#d0d8ff',
    backgroundColor: '#f0f4ff',
  },
  labelChipActive: { borderColor: '#5564ad', backgroundColor: '#eef2ff' },
  labelChipText: { fontSize: 13, color: '#4a4a8a', fontWeight: '600' },
  labelChipTextActive: { color: '#1a1a6e' },
  btnSave: {
    backgroundColor: '#17247a',
    borderRadius: 14,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  inputLocked: { backgroundColor: '#ffffff', borderColor: '#e4e7f2' },
  footerRow: { flexDirection: 'row', gap: 10 },
  btnCancel: {
    borderRadius: 14,
    minHeight: 48,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#17247a',
    backgroundColor: '#fff',
  },
  btnCancelText: { color: '#17247a', fontSize: 16, fontWeight: '700' },
  btnSaveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
