# Rent-A-Car dApp (Soroban + React)

Aplicación descentralizada para alquiler de autos construida sobre **Soroban Smart Contracts (Rust)** y **Frontend React (Scaffold Stellar)**.

---

## 1. Descripción general

## ✨ Características principales

| Función | Admin | Owner | Renter |
|---------|-------|-------|--------|
| Agregar autos | ✅ | ❌ | ❌ |
| Eliminar autos | ✅ | ❌ | ❌ |
| Configurar comisión por alquiler | ✅ | ❌ | ❌ |
| Retirar comisiones acumuladas | ✅ | ❌ | ❌ |
| Recibir depósitos por alquiler | ❌ | ✅ | ❌ |
| Retirar ganancias | ❌ | ✅ (solo si el auto fue devuelto) | ❌ |
| Alquilar autos | ❌ | ❌ | ✅ |

---

## 🔥 Cambios recientes (v2)

### ✅ Smart Contract (Rust / Soroban)

- Añadido **almacenamiento de comisión fija por alquiler** (`AdminFee`)
- Añadido **salario acumulado del admin** (`AdminBalance`)
- `rental()` ahora cobra: `depósito + comisión admin`
- Owners solo pueden retirar si el auto está `Available`
- Añadida función `return_car()` para marcar devolución
- Nuevas funciones:
  ```rust
  set_admin_fee(fee: i128)
  get_admin_fee() -> i128
  admin_withdraw(amount: i128)
  get_owner_balance(owner: Address) -> i128
  

---

<p align="center">
  <img src="https://i.ibb.co/35Yt82Jy/Screenshot-2025-11-02-231108.png" width="850">
</p>
<p align="center">
  <img src="https://i.ibb.co/mVhp1ySt/Screenshot-2025-11-02-231245.png" width="850">
</p>

## 2. Roles del sistema

| Rol       | Funciones principales |
|-----------|-----------------------|
| **Admin** | Agrega/borra autos, configura comisión, puede retirar comisiones |
| **Owner** | Recibe depósitos de alquiler, retira ganancias si el auto fue devuelto |
| **Renter**| Alquila autos, paga depósito + comisión |

---
