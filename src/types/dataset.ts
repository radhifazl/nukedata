export interface DatasetColumn {
  name: string;
}

export interface Dataset {
  name: string;
  fileSize: number;
  columns: DatasetColumn[];
  rows: Record<string, unknown>[];
  rowCount: number;
  createdAt: string;
}
