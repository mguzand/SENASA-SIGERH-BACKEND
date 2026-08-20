export enum LeaveRequestType {
  PAID = 'PAID',
  UNPAID = 'UNPAID',
}

export enum LeaveRequestStage {
  REGIONAL_REVIEW = 'REGIONAL_REVIEW',
  AREA_REVIEW = 'AREA_REVIEW',
  HR_REVIEW = 'HR_REVIEW',
  DIRECTOR_REVIEW = 'DIRECTOR_REVIEW',
  COMPLETED = 'COMPLETED',
}

export enum LeaveReasonType {
  DEATH = 'DEATH',
  PERSONAL = 'PERSONAL',
  IHSS = 'IHSS',
}

export enum LeaveRelationship {
  SELF = 'SELF',
  FATHER = 'FATHER',
  MOTHER = 'MOTHER',
  SON = 'SON',
  DAUGHTER = 'DAUGHTER',
  BROTHER = 'BROTHER',
  SISTER = 'SISTER',
  SPOUSE = 'SPOUSE',
  PARTNER = 'PARTNER',
}

export enum LeaveRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}
