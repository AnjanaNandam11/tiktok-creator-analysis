import axios from 'axios'

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || ''}/api`,
})

export async function getCreators() {
  const { data } = await api.get('/creators')
  return data
}

export async function getCreator(id) {
  const { data } = await api.get(`/creators/${id}`)
  return data
}

export async function getCreatorStats(id) {
  const { data } = await api.get(`/creators/${id}/stats`)
  return data
}

export async function getCreatorPatterns(id) {
  const { data } = await api.get(`/creators/${id}/patterns`)
  return data
}

export async function getCreatorTopVideos(id) {
  const { data } = await api.get(`/creators/${id}/top-videos`)
  return data
}

export async function addCreator(username, niche = '') {
  const { data } = await api.post(
    `/creators?username=${encodeURIComponent(username)}&niche=${encodeURIComponent(niche)}`,
    null,
    { timeout: 120000 }
  )
  return data
}

export async function deleteCreator(id) {
  const { data } = await api.delete(`/creators/${id}`)
  return data
}

export async function scrapeCreator(username) {
  const { data } = await api.post(`/scrape/${username}`)
  return data
}

export async function compareCreators(ids) {
  const { data } = await api.get(`/analytics/compare?creator_ids=${ids.join(',')}`)
  return data
}

export default api
