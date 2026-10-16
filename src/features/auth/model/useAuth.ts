import { useDispatch } from 'react-redux'
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit'
import type { Credentials } from '@/shared/api'
import { logout } from './logout'
import { loginThunk } from './loginThunk'

type Dispatch = ThunkDispatch<unknown, unknown, UnknownAction>

export function useAuthActions() {
  const dispatch = useDispatch<Dispatch>()
  return {
    /** Возвращает текст ошибки или `null` при успехе. */
    async login(credentials: Credentials): Promise<string | null> {
      const result = await dispatch(loginThunk(credentials))
      return loginThunk.fulfilled.match(result)
        ? null
        : (result.payload ?? 'Не удалось войти. Повторите попытку')
    },
    logout: () => dispatch(logout()),
  }
}
