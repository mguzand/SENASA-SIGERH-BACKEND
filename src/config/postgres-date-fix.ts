import { types } from 'pg';

// 1184 = timestamptz en PostgreSQL
types.setTypeParser(1184, (value: string) => {
  return value; // lo devuelve como string, NO como Date
});

// 1114 = timestamp
types.setTypeParser(1114, (value: string) => {
  return value;
});
