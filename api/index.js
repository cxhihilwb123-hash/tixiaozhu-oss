import { requestHandler } from '../backend/src/server.js'

export default function handler(req, res) {
  return requestHandler(req, res)
}
