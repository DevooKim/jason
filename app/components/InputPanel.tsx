import { ChangeEvent } from "react";
import { Button, Card, CardContent, TextArea } from "@heroui/react";

interface InputPanelProps {
  pasteText: string;
  onPasteTextChange: (next: string) => void;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onPasteFromClipboard: () => void;
  onParsePastedText: () => void;
}

export function InputPanel({
  pasteText,
  onPasteTextChange,
  onUpload,
  onPasteFromClipboard,
  onParsePastedText,
}: InputPanelProps) {
  return (
    <Card className="source-card">
      <CardContent>
        <div className="input-row">
          <label className="upload-label">
            <Button size="sm" className="ui-button">
              파일 업로드
            </Button>
            <input
              type="file"
              accept=".json,.txt,application/json,text/plain"
              onChange={onUpload}
            />
          </label>

          <Button size="sm" onPress={onPasteFromClipboard} className="ui-button">
            클립보드 붙여넣기
          </Button>
        </div>

        <div className="input-row input-row--stack">
          <TextArea
            value={pasteText}
            onChange={event => onPasteTextChange(event.target.value)}
            rows={6}
            className="paste-area"
            placeholder="JSON 텍스트 직접 붙여넣기"
          />
          <Button size="sm" onPress={onParsePastedText} className="ui-button">
            붙여넣은 내용 파싱
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
