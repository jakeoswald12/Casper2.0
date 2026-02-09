// Shared type definitions between client and server

export interface SummaryItem {
  id: string;
  type: 'section' | 'item';
  title: string;
  content: string;
  children?: SummaryItem[];
  position: number;
}

export const DEFAULT_SUMMARY: SummaryItem[] = [
  {
    id: 'overview',
    type: 'section',
    title: 'Overview',
    content: '',
    position: 0,
    children: [],
  },
  {
    id: 'audience',
    type: 'section',
    title: 'Target Audience',
    content: '',
    position: 1,
    children: [],
  },
  {
    id: 'tone',
    type: 'section',
    title: 'Tone & Style',
    content: '',
    position: 2,
    children: [],
  },
  {
    id: 'context',
    type: 'section',
    title: 'Context & Setting',
    content: '',
    position: 3,
    children: [],
  },
  {
    id: 'characters',
    type: 'section',
    title: 'Characters',
    content: '',
    position: 4,
    children: [],
  },
];

export interface OutlineItemType {
  id: string;
  bookId: number;
  parentId: string | null;
  type: 'part' | 'chapter' | 'subsection' | 'bullet';
  content: string;
  position: number;
  children?: OutlineItemType[];
}
