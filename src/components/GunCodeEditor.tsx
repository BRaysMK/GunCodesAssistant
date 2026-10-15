import { useEffect, useRef, useState } from "react";
import {
  Button, DrawerBody, DrawerHeader, DrawerHeaderTitle, Field, Input,
  MessageBar, MessageBarBody, MessageBarTitle, OverlayDrawer, Spinner,
  Textarea, makeStyles, tokens,
} from "@fluentui/react-components";
import {
  CheckmarkCircleRegular, DismissRegular, SaveRegular, WarningRegular,
} from "@fluentui/react-icons";
import type { GunCode, RecognizeResult } from "@/lib/gunCodes";

const useStyles = makeStyles({
  body: {
    display: "flex",
    flexDirection: "column",
    rowGap: tokens.spacingVerticalL,
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    columnGap: tokens.spacingHorizontalS,
    paddingBlock: tokens.spacingVerticalL,
    paddingInline: tokens.spacingHorizontalXXL,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    marginTop: "auto",
  },
  recog: { marginTop: tokens.spacingVerticalXS },
  meta: {
    color: tokens.colorNeutralForeground3,
    display: "block",
    marginTop: tokens.spacingVerticalXS,
  },
});

/**
 * 改枪码编辑器（Fluent OverlayDrawer）
 *
 * v1.3.0 把「添加」与「编辑」合并到同一个抽屉：两者的字段、识别提示、校验
 * 完全一致，此前拆成「抽屉新增 + 卡片内联编辑」两套界面，行为容易漂移。
 *
 * 识别时机与 v1.1.0 一致：粘贴后 250ms 防抖调用后端 `recognize_gun_name`，
 * 已识别则自动填充枪名与备注（用户仍可改写），未识别则提示保存后会学习指纹。
 */
export function GunCodeEditor({
  open,
  editing,
  onClose,
  onRecognize,
  onSave,
  onUpdate,
}: {
  open: boolean;
  /** 非空表示编辑已有条目 */
  editing: GunCode | null;
  onClose: () => void;
  onRecognize: (code: string) => Promise<RecognizeResult>;
  onSave: (weaponName: string, code: string, note: string) => Promise<void>;
  onUpdate: (id: string, weaponName: string, code: string, note: string) => Promise<void>;
}) {
  const styles = useStyles();
  const [code, setCode] = useState("");
  const [weapon, setWeapon] = useState("");
  const [note, setNote] = useState("");
  const [recog, setRecog] = useState<RecognizeResult | null>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [saving, setSaving] = useState(false);
  const timer = useRef<number | null>(null);

  // 打开时重置 / 预填
  useEffect(() => {
    if (!open) return;
    setCode(editing?.code ?? "");
    setWeapon(editing?.weapon_name ?? "");
    setNote(editing?.note ?? "");
    setRecog(null);
    setRecognizing(false);
    setSaving(false);
    if (timer.current) window.clearTimeout(timer.current);
  }, [open, editing]);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const runRecognize = (value: string) => {
    const clean = value.replace(/[^a-zA-Z0-9]/g, "");
    if (timer.current) window.clearTimeout(timer.current);
    if (clean.length < 6) {
      setRecog(null);
      setRecognizing(false);
      return;
    }
    setRecognizing(true);
    timer.current = window.setTimeout(async () => {
      try {
        const r = await onRecognize(value);
        setRecog(r);
        if (r.recognized) {
          setWeapon(r.weapon_name);
          setNote(r.note || "");
        } else {
          setNote("");
        }
      } catch {
        setRecog(null);
      } finally {
        setRecognizing(false);
      }
    }, 250);
  };

  const handleCode = (v: string) => {
    setCode(v);
    // 编辑模式下改码不重新识别：用户此时多半是在修正已存数据，
    // 自动覆盖枪名会抹掉他的手改结果。
    if (!editing) runRecognize(v);
  };

  const save = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      if (editing) {
        await onUpdate(editing.id, weapon || editing.weapon_name, trimmed, note);
      } else {
        await onSave(weapon, trimmed, note);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const canSave = code.trim().length > 0 && !saving;
  const recognized = recog?.recognized === true;

  return (
    <OverlayDrawer
      open={open}
      onOpenChange={(_e, data) => {
        if (!data.open) onClose();
      }}
      position="end"
      size="medium"
      modalType="modal"
      aria-label={editing ? "编辑改枪码" : "添加改枪码"}
    >
      <DrawerHeader>
        <DrawerHeaderTitle
          action={
            <Button
              appearance="subtle"
              icon={<DismissRegular />}
              aria-label="关闭"
              onClick={onClose}
            />
          }
        >
          {editing ? "编辑改枪码" : "添加改枪码"}
        </DrawerHeaderTitle>
      </DrawerHeader>

      <DrawerBody className={styles.body}>
        <Field
          label="改枪码"
          required
          hint={
            editing
              ? "修改代码不会自动重新识别，请自行确认枪名与备注"
              : "粘贴后自动识别枪名与配置"
          }
        >
          <Textarea
            value={code}
            onChange={(_e, data) => handleCode(data.value)}
            placeholder="例如 6KFCC1K08QMG6NRUK6UQC"
            rows={3}
            resize="vertical"
            autoFocus
          />
        </Field>

        {!editing && recognizing && (
          <Spinner size="tiny" label="识别中…" labelPosition="after" />
        )}

        {!editing && recog && (
          <MessageBar
            className={styles.recog}
            intent={recognized ? "success" : "warning"}
            icon={recognized ? <CheckmarkCircleRegular /> : <WarningRegular />}
          >
            <MessageBarBody>
              <MessageBarTitle>
                {recognized ? `已识别：${recog.weapon_name}` : "未识别出枪名"}
              </MessageBarTitle>
              {recognized
                ? recog.reason
                : "可手动填写枪名后保存 —— 保存后会学习该指纹，下次粘贴同枪代码即可自动识别。"}
              {recognized && recog.confidence > 0 && (
                <span className={styles.meta}>
                  置信度 {Math.round(recog.confidence * 100)}%
                  {recog.confidence < 1 ? "（非精确匹配，请核对）" : ""}
                </span>
              )}
            </MessageBarBody>
          </MessageBar>
        )}

        <Field label="枪名" hint={editing ? "留空则保持原标题" : "可手动修正"}>
          <Input
            value={weapon}
            onChange={(_e, data) => setWeapon(data.value)}
            placeholder="例如 RM277"
          />
        </Field>

        <Field label="配置 / 备注">
          <Input
            value={note}
            onChange={(_e, data) => setNote(data.value)}
            placeholder="例如 20W青春版 / 55W满改红点"
          />
        </Field>
      </DrawerBody>

      <div className={styles.footer}>
        <Button appearance="secondary" onClick={onClose}>
          取消
        </Button>
        <Button
          appearance="primary"
          icon={<SaveRegular />}
          disabled={!canSave}
          onClick={save}
        >
          {saving ? "保存中…" : editing ? "保存修改" : "保存"}
        </Button>
      </div>
    </OverlayDrawer>
  );
}

/** 供上层复用的文案常量（避免「未知枪械」在多处硬编码后漂移） */
export const UNKNOWN_GUN_NAME = "未知枪械";
