import { createAsyncThunk } from '@reduxjs/toolkit'
import { setCredentials } from '@/entities/session'
import { getStateInstance } from '@/shared/api'
import type { Credentials } from '@/shared/api'
import { instanceStateMessage, loginErrorMessage } from './errorMessage'

/**
 * Проверяет креды запросом getStateInstance: неверные данные ловим при входе,
 * а не при первой отправке. При успехе кладёт креды в entities/session.
 */
export const loginThunk = createAsyncThunk<Credentials, Credentials, { rejectValue: string }>(
  'auth/login',
  async (credentials, { dispatch, rejectWithValue }) => {
    try {
      const { stateInstance } = await getStateInstance(credentials)
      const problem = instanceStateMessage(stateInstance)
      if (problem) return rejectWithValue(problem)
      dispatch(setCredentials(credentials))
      return credentials
    } catch (error) {
      return rejectWithValue(loginErrorMessage(error))
    }
  },
)
