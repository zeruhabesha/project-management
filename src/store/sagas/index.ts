import { all } from 'redux-saga/effects';
import authSaga from './authSaga';
import projectsSaga from './projectsSaga';
import itemsSaga from './itemsSaga';
import usersSaga from './usersSaga';

export function* rootSaga() {
  yield all([
    authSaga(),
    projectsSaga(),
    itemsSaga(),
    usersSaga(),
  ]);
}