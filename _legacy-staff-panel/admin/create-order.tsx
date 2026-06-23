import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useAuthStore } from '../../src/store/auth.store'

const API_URL = 'http://192.168.0.107:3000/api'

// ── Tipos ────────────────────────────────────────────────────────
interface FaultItem {
  id: string
  name: string
  description: string
  estimatedPrice: number | null
  requiresShop?: boolean
}

interface FaultCategory {
  id: string
  title: string
  icon: string
  items: FaultItem[]
}

interface SelectedItem {
  id: string
  name: string
  price: number
  isCustom?: boolean
}

// ── Catálogo ─────────────────────────────────────────────────────
const FAULT_CATEGORIES: FaultCategory[] = [
  {
    id: 'power',
    title: 'Alimentación y encendido',
    icon: '🔌',
    items: [
      { id: 'p1', name: 'No enciende absolutamente nada', description: 'Sin luces ni ventilador — posible corto, pin de carga dañado o cargador quemado', estimatedPrice: 50, requiresShop: true },
      { id: 'p2', name: 'Prende pero no da video', description: 'Arranca pero pantalla en negro — RAM sucia, BIOS corrupta o chip de video', estimatedPrice: 40, requiresShop: true },
      { id: 'p3', name: 'Se apaga sola a los pocos minutos', description: 'Sobrecalentamiento por pasta térmica seca o ventilador trancado', estimatedPrice: 25 },
      { id: 'p4', name: 'Batería conectada pero no carga', description: 'Batería agotada, celdas dañadas o falla en circuito de carga', estimatedPrice: 20 },
    ],
  },
  {
    id: 'screen',
    title: 'Pantalla y video',
    icon: '🖥️',
    items: [
      { id: 's1', name: 'Pantalla rota, partida o con líneas', description: 'Daño físico por golpes o presión. Repuesto se cotiza aparte', estimatedPrice: 15, requiresShop: true },
      { id: 's2', name: 'Pantalla parpadea o da colores extraños', description: 'Falla del cable Flex al mover la tapa', estimatedPrice: 25, requiresShop: true },
      { id: 's3', name: 'Pantalla muy oscura o sin brillo', description: 'Falla del circuito de iluminación o inverter', estimatedPrice: 30, requiresShop: true },
    ],
  },
  {
    id: 'peripherals',
    title: 'Periféricos y conectividad',
    icon: '⌨️',
    items: [
      { id: 'per1', name: 'Teclas que no funcionan o locas', description: 'Teclado sulfatado por humedad, derrame de líquido o desgaste de membrana', estimatedPrice: 20 },
      { id: 'per2', name: 'Puertos USB, HDMI o Jack flojos', description: 'Soldaduras rotas por tirones o pines partidos. Requiere taller', estimatedPrice: 25, requiresShop: true },
      { id: 'per3', name: 'No detecta WiFi o se desconecta', description: 'Tarjeta de red dañada, floja o cables de antena partidos', estimatedPrice: 20 },
    ],
  },
  {
    id: 'mechanical',
    title: 'Mecánica y estructura',
    icon: '⚙️',
    items: [
      { id: 'm1', name: 'Ruido fuerte en el ventilador', description: 'Cooler lleno de polvo, desgastado o eje partido', estimatedPrice: 20 },
      { id: 'm2', name: 'Bisagras trancadas o carcasa rota', description: 'Si no se repara puede partir la pantalla', estimatedPrice: 35, requiresShop: true },
    ],
  },
  {
    id: 'performance',
    title: 'Rendimiento y estabilidad',
    icon: '🐌',
    items: [
      { id: 'rf1', name: 'Lentitud extrema al arrancar o abrir programas', description: 'Disco duro en las últimas, falta de RAM o exceso de programas al inicio', estimatedPrice: 20 },
      { id: 'rf2', name: 'Pantallazo azul (BSOD)', description: 'Drivers incompatibles, actualizaciones corruptas o fallas de hardware', estimatedPrice: 20 },
      { id: 'rf3', name: 'Equipo se congela por completo (Freezing)', description: 'Conflicto de drivers, malware pesado o problemas de temperatura', estimatedPrice: 20 },
    ],
  },
  {
    id: 'os',
    title: 'Sistema operativo y almacenamiento',
    icon: '💽',
    items: [
      { id: 'os1', name: 'No Bootable Device / Falta sistema operativo', description: 'Disco desconectado, dañado o sector de arranque corrupto', estimatedPrice: 25 },
      { id: 'os2', name: 'Bucle de reparación automática de Windows', description: 'Archivos del sistema dañados por apagón o mala actualización', estimatedPrice: 25 },
      { id: 'os3', name: 'Pérdida de acceso a carpetas o archivos', description: 'Errores de lectura o disco que pide formatear al conectarlo', estimatedPrice: 20 },
    ],
  },
  {
    id: 'security',
    title: 'Seguridad y configuración',
    icon: '🌐',
    items: [
      { id: 'sec1', name: 'Virus, malware o publicidad emergente', description: 'El equipo abre ventanas solas, redirige búsquedas o está muy lento', estimatedPrice: 20 },
      { id: 'sec2', name: 'Programas o sistemas administrativos que no abren', description: 'Conflictos con framework, falta de permisos o bases de datos corruptas', estimatedPrice: 15 },
      { id: 'sec3', name: 'Problemas de activación de Windows u Office', description: 'Mensajes de copia no original u Office bloqueado', estimatedPrice: 10 },
    ],
  },
  {
    id: 'services',
    title: 'Servicios',
    icon: '🛠️',
    items: [
      { id: 'sv1', name: 'Mantenimiento preventivo', description: 'Limpieza interna, cambio de pasta térmica básica, revisión general', estimatedPrice: 20 },
      { id: 'sv2', name: 'Mantenimiento equipo gaming / diseño', description: 'Desarmado completo, limpieza profunda, pasta térmica premium', estimatedPrice: 40 },
      { id: 'sv3', name: 'Formateo / reinstalación de Windows', description: 'Formateo completo, instalación limpia de Windows y drivers básicos', estimatedPrice: 20 },
      { id: 'sv4', name: 'Instalación de software / APK', description: 'Programas específicos, emuladores o configuración de sistemas', estimatedPrice: 10 },
      { id: 'sv5', name: 'Licenciamiento / activación', description: 'Activación de Windows u Office con licencia original o genérica', estimatedPrice: 10 },
      { id: 'sv6', name: 'Respaldo de datos', description: 'Copia de seguridad. Precio base hasta 100GB — extra por volumen adicional', estimatedPrice: 15 },
      { id: 'sv7', name: 'Cambio de componente (teclado, batería, ventilador)', description: 'Solo mano de obra. Repuesto se cotiza aparte', estimatedPrice: 15 },
      { id: 'sv8', name: 'Reballing / reparación de placa madre', description: 'Microsoldadura y reparación electrónica a nivel de componentes', estimatedPrice: 60, requiresShop: true },
      { id: 'sv9', name: 'Reemplazo de pasta térmica premium', description: 'Pasta de alta gama para gaming o diseño', estimatedPrice: 20 },
    ],
  },
]

const DEVICE_TYPES = ['LAPTOP', 'PC']

export default function CreateOrderScreen() {
  const { clientId, clientName } = useLocalSearchParams<{
    clientId: string
    clientName: string
  }>()
  const router = useRouter()
  const { token } = useAuthStore()

  // ── Datos del equipo ─────────────────────────────────────────────
  const [deviceType, setDeviceType] = useState<'LAPTOP' | 'PC'>('LAPTOP')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [color, setColor] = useState('')
  const [accessories, setAccessories] = useState('')
  const [noAccessories, setNoAccessories] = useState(false)
  const [devicePassword, setDevicePassword] = useState('')
  const [noPassword, setNoPassword] = useState(false)

  // ── Selección múltiple ───────────────────────────────────────────
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([])

  // ── Falla personalizada ──────────────────────────────────────────
  const [showCustom, setShowCustom] = useState(false)
  const [customFault, setCustomFault] = useState('')
  const [customPrice, setCustomPrice] = useState('')

  // ── Observaciones ────────────────────────────────────────────────
  const [observations, setObservations] = useState('')
  const [saving, setSaving] = useState(false)

  // ── Total estimado ───────────────────────────────────────────────
  const totalEstimated = selectedItems.reduce((sum, item) => sum + item.price, 0)

  const toggleCategory = (id: string) => {
    setExpandedCategory(prev => prev === id ? null : id)
  }

  const toggleItem = (item: FaultItem) => {
    const exists = selectedItems.find(s => s.id === item.id)
    if (exists) {
      setSelectedItems(prev => prev.filter(s => s.id !== item.id))
    } else {
      setSelectedItems(prev => [...prev, {
        id: item.id,
        name: item.name,
        price: item.estimatedPrice ?? 0,
      }])
    }
  }

  const isSelected = (id: string) => selectedItems.some(s => s.id === id)

  const addCustomFault = () => {
    if (!customFault.trim()) {
      Alert.alert('Error', 'Describe la falla o servicio')
      return
    }
    const price = parseFloat(customPrice || '0')
    setSelectedItems(prev => [...prev, {
      id: `custom_${Date.now()}`,
      name: customFault.trim(),
      price,
      isCustom: true,
    }])
    setCustomFault('')
    setCustomPrice('')
    setShowCustom(false)
  }

  const removeItem = (id: string) => {
    setSelectedItems(prev => prev.filter(s => s.id !== id))
  }

  const handleNoAccessories = () => {
    const next = !noAccessories
    setNoAccessories(next)
    if (next) setAccessories('Sin accesorios')
    else setAccessories('')
  }

  const handleNoPassword = () => {
    setNoPassword(!noPassword)
    if (!noPassword) setDevicePassword('')
  }

  const handleSubmit = async () => {
    if (!brand.trim() || !model.trim()) {
      Alert.alert('Error', 'Marca y modelo son obligatorios')
      return
    }
    if (!color.trim()) {
      Alert.alert('Error', 'El color del equipo es obligatorio')
      return
    }
    if (!accessories.trim()) {
      Alert.alert('Error', 'Indica los accesorios o marca "Sin accesorios"')
      return
    }
    if (!noPassword && !devicePassword.trim()) {
      Alert.alert('Error', 'Indica la contraseña o marca "Sin contraseña"')
      return
    }
    if (selectedItems.length === 0) {
      Alert.alert('Error', 'Selecciona al menos una falla o servicio')
      return
    }

    const problem = selectedItems.map(i => i.name).join(' | ')

    setSaving(true)
    try {
      // Paso 1 — Crear dispositivo
      const deviceRes = await fetch(`${API_URL}/devices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: deviceType,
          brand: brand.trim(),
          model: model.trim(),
          serialNumber: serialNumber.trim() || undefined,
          color: color.trim(),
          accessories: accessories.trim(),
          devicePassword: noPassword ? undefined : devicePassword.trim(),
        }),
      })
      const deviceData = await deviceRes.json()
      if (!deviceRes.ok || !deviceData.success) {
        Alert.alert('Error', deviceData.message || 'No se pudo registrar el equipo')
        return
      }

      // Paso 2 — Crear orden
      const orderRes = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          clientId,
          deviceId: deviceData.data.id,
          problem,
          observations: observations.trim() || undefined,
        }),
      })
      const orderData = await orderRes.json()
      if (!orderRes.ok || !orderData.success) {
        Alert.alert('Error', orderData.message || 'No se pudo crear la orden')
        return
      }

      const techName = orderData.data.technician?.name || 'Por asignar'

      Alert.alert(
        '✅ Orden creada',
        `Número: ${orderData.data.orderNumber}\nTécnico: ${techName}\nTotal estimado: $${totalEstimated}`,
        [{ text: 'Aceptar', onPress: () => router.replace('/(admin)/dashboard') }]
      )
    } catch {
      Alert.alert('Error', 'No se pudo conectar al servidor')
    } finally {
      setSaving(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">

        {/* ── Banner cliente ── */}
        <View style={styles.clientBanner}>
          <Text style={styles.clientLabel}>Cliente</Text>
          <Text style={styles.clientName}>{clientName}</Text>
        </View>

        {/* ── Datos del equipo ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💻 Datos del equipo</Text>

          <Text style={styles.label}>Tipo *</Text>
          <View style={styles.typeRow}>
            {DEVICE_TYPES.map(type => (
              <TouchableOpacity
                key={type}
                style={[styles.typeBtn, deviceType === type && styles.typeBtnActive]}
                onPress={() => setDeviceType(type as 'LAPTOP' | 'PC')}
              >
                <Text style={[styles.typeBtnText, deviceType === type && styles.typeBtnTextActive]}>
                  {type === 'LAPTOP' ? '💻 Laptop' : '🖥️ PC'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Marca *</Text>
          <TextInput style={styles.input} placeholder="Ej: HP, Dell, Lenovo"
            value={brand} onChangeText={setBrand} />

          <Text style={styles.label}>Modelo *</Text>
          <TextInput style={styles.input} placeholder="Ej: Pavilion 15, Inspiron 3501"
            value={model} onChangeText={setModel} />

          <Text style={styles.label}>Color *</Text>
          <TextInput style={styles.input} placeholder="Ej: Negro, Plateado, Azul"
            value={color} onChangeText={setColor} />

          <Text style={styles.label}>Número de serie</Text>
          <TextInput style={styles.input} placeholder="Opcional — visible en etiqueta del equipo"
            value={serialNumber} onChangeText={setSerialNumber} />

          <Text style={styles.label}>Accesorios entregados *</Text>
          <TextInput style={styles.input} placeholder="Ej: Cargador, mochila, mouse"
            value={accessories} onChangeText={setAccessories} editable={!noAccessories} />
          <TouchableOpacity style={styles.checkRow} onPress={handleNoAccessories}>
            <View style={[styles.checkbox, noAccessories && styles.checkboxActive]}>
              {noAccessories && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkLabel}>Sin accesorios</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Contraseña del equipo *</Text>
          <TextInput style={styles.input} placeholder="Necesaria para pruebas del técnico"
            value={devicePassword} onChangeText={setDevicePassword} editable={!noPassword} />
          <TouchableOpacity style={styles.checkRow} onPress={handleNoPassword}>
            <View style={[styles.checkbox, noPassword && styles.checkboxActive]}>
              {noPassword && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkLabel}>Sin contraseña</Text>
          </TouchableOpacity>
        </View>

        {/* ── Falla o servicio ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔧 Falla o servicio reportado</Text>
          <Text style={styles.sectionHint}>Puedes seleccionar varios</Text>

          {/* Categorías colapsables */}
          {FAULT_CATEGORIES.map(cat => (
            <View key={cat.id}>
              <TouchableOpacity
                style={styles.categoryHeader}
                onPress={() => toggleCategory(cat.id)}
              >
                <Text style={styles.categoryTitle}>{cat.icon} {cat.title}</Text>
                <Text style={styles.categoryArrow}>
                  {expandedCategory === cat.id ? '▲' : '▼'}
                </Text>
              </TouchableOpacity>

              {expandedCategory === cat.id && (
                <View style={styles.categoryItems}>
                  {cat.items.map(item => (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.faultItem, isSelected(item.id) && styles.faultItemSelected]}
                      onPress={() => toggleItem(item)}
                    >
                      <View style={styles.faultItemContent}>
                        <View style={[styles.checkbox, isSelected(item.id) && styles.checkboxActive, { marginRight: 10, marginTop: 2 }]}>
                          {isSelected(item.id) && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.faultItemName}>{item.name}</Text>
                          <Text style={styles.faultItemDesc}>{item.description}</Text>
                          {item.requiresShop && (
                            <Text style={styles.requiresShop}>⚠️ Requiere evaluación en taller</Text>
                          )}
                        </View>
                        <Text style={styles.faultItemPrice}>
                          {item.estimatedPrice ? `$${item.estimatedPrice}` : 'A evaluar'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ))}

          {/* Falla personalizada */}
          {!showCustom ? (
            <TouchableOpacity style={styles.customBtn} onPress={() => setShowCustom(true)}>
              <Text style={styles.customBtnText}>✏️ La falla no está en la lista</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.customForm}>
              <Text style={styles.label}>Describe la falla o servicio *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe lo que el cliente reporta..."
                value={customFault}
                onChangeText={setCustomFault}
                multiline
                numberOfLines={3}
              />
              <Text style={styles.label}>Precio estimado acordado ($)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: 25 — déjalo vacío si es a evaluar"
                value={customPrice}
                onChangeText={setCustomPrice}
                keyboardType="numeric"
              />
              <View style={styles.customActions}>
                <TouchableOpacity style={styles.btnAdd} onPress={addCustomFault}>
                  <Text style={styles.btnAddText}>+ Agregar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnCancel} onPress={() => setShowCustom(false)}>
                  <Text style={styles.btnCancelText}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* ── Resumen seleccionados ── */}
        {selectedItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📋 Resumen</Text>
            {selectedItems.map(item => (
              <View key={item.id} style={styles.summaryRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.summaryName}>{item.name}</Text>
                  {item.isCustom && (
                    <Text style={styles.summaryCustomTag}>Personalizado</Text>
                  )}
                </View>
                <Text style={styles.summaryPrice}>
                  {item.price > 0 ? `$${item.price}` : 'A evaluar'}
                </Text>
                <TouchableOpacity onPress={() => removeItem(item.id)} style={styles.removeBtn}>
                  <Text style={styles.removeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>💰 Total estimado</Text>
              <Text style={styles.totalValue}>${totalEstimated}</Text>
            </View>
            <Text style={styles.totalNote}>Sujeto a confirmación del técnico</Text>
          </View>
        )}

        {/* ── Observaciones ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📝 Observaciones del cliente</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Ej: El cargador también falla, el equipo se cayó..."
            value={observations}
            onChangeText={setObservations}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* ── Botón crear orden ── */}
        <TouchableOpacity
          style={[styles.btnSave, saving && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnSaveText}>✅ Crear Orden</Text>
          }
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  clientBanner: { backgroundColor: '#1a73e8', padding: 16, paddingTop: 20 },
  clientLabel: { color: '#c8e0ff', fontSize: 12 },
  clientName: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  section: { backgroundColor: '#fff', margin: 12, borderRadius: 12, padding: 16, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1E3A5F', marginBottom: 4 },
  sectionHint: { fontSize: 12, color: '#888', marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 4, marginTop: 8 },
  input: {
    backgroundColor: '#f9f9f9', borderRadius: 8, padding: 12,
    fontSize: 15, borderWidth: 1, borderColor: '#e0e0e0', marginBottom: 4,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  typeBtn: {
    flex: 1, padding: 12, borderRadius: 8, borderWidth: 2,
    borderColor: '#e0e0e0', alignItems: 'center', backgroundColor: '#f9f9f9',
  },
  typeBtnActive: { borderColor: '#1a73e8', backgroundColor: '#e8f0fe' },
  typeBtnText: { fontSize: 15, color: '#666', fontWeight: '600' },
  typeBtnTextActive: { color: '#1a73e8' },
  checkRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginTop: 2 },
  checkbox: {
    width: 22, height: 22, borderRadius: 4, borderWidth: 2,
    borderColor: '#ccc', marginRight: 8, alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: '#1a73e8', borderColor: '#1a73e8' },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  checkLabel: { fontSize: 14, color: '#555' },
  categoryHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  categoryTitle: { fontSize: 15, fontWeight: '600', color: '#1E3A5F' },
  categoryArrow: { color: '#666', fontSize: 13 },
  categoryItems: { backgroundColor: '#fafafa', borderRadius: 8, marginBottom: 4 },
  faultItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  faultItemSelected: { backgroundColor: '#e8f0fe' },
  faultItemContent: { flexDirection: 'row', alignItems: 'flex-start' },
  faultItemName: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 2 },
  faultItemDesc: { fontSize: 12, color: '#777', lineHeight: 16 },
  requiresShop: { fontSize: 11, color: '#e65100', marginTop: 3, fontWeight: '600' },
  faultItemPrice: { fontSize: 15, fontWeight: '700', color: '#1a73e8', marginLeft: 8, minWidth: 55, textAlign: 'right' },
  customBtn: {
    borderWidth: 2, borderColor: '#1a73e8', borderStyle: 'dashed',
    borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8,
  },
  customBtnText: { color: '#1a73e8', fontSize: 15, fontWeight: '600' },
  customForm: {
    backgroundColor: '#f9f9f9', borderRadius: 8, padding: 12, marginTop: 8,
    borderWidth: 1, borderColor: '#e0e0e0',
  },
  customActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  btnAdd: {
    flex: 1, backgroundColor: '#1a73e8', borderRadius: 8,
    padding: 12, alignItems: 'center',
  },
  btnAddText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnCancel: {
    flex: 1, backgroundColor: '#f0f0f0', borderRadius: 8,
    padding: 12, alignItems: 'center',
  },
  btnCancelText: { color: '#666', fontWeight: '600', fontSize: 15 },
  summaryRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  summaryName: { fontSize: 14, color: '#333', fontWeight: '500' },
  summaryCustomTag: { fontSize: 11, color: '#1a73e8', marginTop: 2 },
  summaryPrice: { fontSize: 15, fontWeight: '700', color: '#1a73e8', marginRight: 8 },
  removeBtn: { padding: 4 },
  removeBtnText: { color: '#e53935', fontSize: 16, fontWeight: 'bold' },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: 12, paddingTop: 8,
  },
  totalLabel: { fontSize: 15, fontWeight: '700', color: '#1E3A5F' },
  totalValue: { fontSize: 24, fontWeight: 'bold', color: '#34a853' },
  totalNote: { fontSize: 12, color: '#888', marginTop: 4 },
  btnSave: {
    backgroundColor: '#34a853', borderRadius: 12, padding: 16,
    margin: 12, alignItems: 'center', elevation: 2,
  },
  btnDisabled: { backgroundColor: '#aaa' },
  btnSaveText: { color: '#fff', fontSize: 17, fontWeight: '700' },
})