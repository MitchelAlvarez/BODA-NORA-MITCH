import { updateInvitado } from '../services/invitadoUpdate'
import { useState } from 'react'

export function useInvitado() {
    const [responseCall, setResponseCall] = useState()

    const updateInvitados = async ({ invitadoIdToUpdate, asistencia, numero_de_invitados }) => {
        const responseUpdate = await updateInvitado({ invitadoIdToUpdate, asistencia, numero_de_invitados })
        setResponseCall(responseUpdate)
        return responseUpdate
    }


    return { responseCall, updateInvitados }
}