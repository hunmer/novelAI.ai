export type FlowgramSegmentType = 'meta' | 'narration' | 'dialogue' | 'choices';

export interface FlowgramMetaSegment {
  type: 'meta';
  title: string;
  genre?: string;
  style?: string;
  pov?: string;
  tags?: string[];
}

export interface FlowgramNarrationSegment {
  type: 'narration';
  text: string;
}

export interface FlowgramDialogueSegment {
  type: 'dialogue';
  character: string;
  message: string;
  action?: string;
}

export interface FlowgramChoiceOption {
  id: string;
  summary: string;
  hint?: string;
  keywords?: string[];
}

export interface FlowgramChoicesSegment {
  type: 'choices';
  step: number;
  options: FlowgramChoiceOption[];
}

export type FlowgramSegment =
  | FlowgramMetaSegment
  | FlowgramNarrationSegment
  | FlowgramDialogueSegment
  | FlowgramChoicesSegment;

export type PlotNodeKind = 'narration' | 'dialogue' | 'branch';

export interface PlotNode {
  id: string;
  kind: PlotNodeKind;
  /**
   * 自然语言内容：旁白对应 text；角色消息使用 message。
   */
  text: string;
  /**
   * 当 kind === 'dialogue' 时记录角色名称。
   */
  character?: string;
  /**
   * 当 kind === 'dialogue' 时记录角色动作或语气。
   */
  action?: string;
  /**
   * 来源于哪一个选项分支，便于在画布中展示。
   */
  fromOptionId?: string | null;
  /**
   * 当 kind === 'branch' 时用于记录分支提示词。
   */
  prompt?: string | null;
  createdAt: string;
}

export interface PlotWorkflowState {
  nodes: PlotNode[];
}

export interface PlotMetadata {
  title: string;
  genre?: string;
  style?: string;
  pov?: string;
  tags?: string[];
  promptId?: string | null;
  lastPrompt?: string | null;
  lastSegments?: FlowgramSegment[];
}

export interface PlotRecord {
  id: string;
  projectId: string;
  workflow: PlotWorkflowState;
  metadata: PlotMetadata;
  createdAt: string;
  updatedAt: string;
}
