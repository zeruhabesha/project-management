import { call, put, takeEvery, select } from 'redux-saga/effects';
import { PayloadAction } from '@reduxjs/toolkit';
import * as authApi from '../../services/api/auth';
import { 
  loginStart, 
  loginSuccess, 
  loginFailure,
  registerStart,
  registerSuccess,
  registerFailure,
  getCurrentUserStart,
  getCurrentUserSuccess,
  getCurrentUserFailure,
  logout
} from '../slices/authSlice';

function* loginSaga(action: PayloadAction<{ email: string; password: string }>) {
  try {
    const response = yield call(authApi.login, action.payload);
    localStorage.setItem('token', response.data.token);
    yield put(loginSuccess({ user: response.data.user, token: response.data.token }));
  } catch (error: any) {
    yield put(loginFailure(error.response?.data?.message || 'Login failed'));
  }
}

function* registerSaga(action: PayloadAction<{ name: string; email: string; password: string; role?: string }>) {
  try {
    const response = yield call(authApi.register, action.payload);
    localStorage.setItem('token', response.data.token);
    yield put(registerSuccess({ user: response.data.user, token: response.data.token }));
  } catch (error: any) {
    yield put(registerFailure(error.response?.data?.message || 'Registration failed'));
  }
}

function* getCurrentUserSaga() {
  try {
    const response = yield call(authApi.getCurrentUser);
    yield put(getCurrentUserSuccess(response.data.user));
  } catch (error: any) {
    yield put(getCurrentUserFailure(error.response?.data?.message || 'Failed to get user'));
    localStorage.removeItem('token');
  }
}

function* logoutSaga() {
  localStorage.removeItem('token');
}

export default function* authSaga() {
  yield takeEvery(loginStart.type, loginSaga);
  yield takeEvery(registerStart.type, registerSaga);
  yield takeEvery(getCurrentUserStart.type, getCurrentUserSaga);
  yield takeEvery(logout.type, logoutSaga);
}