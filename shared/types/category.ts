export interface Category {
  id: number
  slug: string
  label: string
  icon: string
  color: string
  sortOrder: number
  enabled: boolean
  uploadMinGroup: 'user' | 'power' | 'staff'
  browseMinGroup: 'all' | 'user' | 'power' | 'staff'
  subcats: string[]
  createdAt: string
  torrentCount?: number
}

export interface CategoryCreateInput {
  slug: string
  label: string
  icon?: string
  color?: string
  sortOrder?: number
  uploadMinGroup?: Category['uploadMinGroup']
  browseMinGroup?: Category['browseMinGroup']
  subcats?: string[]
}
