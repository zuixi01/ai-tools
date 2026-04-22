import type { ButtonHTMLAttributes, ReactNode } from "react";

type ActionButtonTone = "primary" | "secondary" | "danger" | "link";
type ActionButtonSize = "md" | "sm";

type BaseProps = {
  children: ReactNode;
  tone?: ActionButtonTone;
  size?: ActionButtonSize;
  className?: string;
};

type ButtonProps = BaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: never;
  };

type LinkProps = BaseProps & {
  href: string;
  target?: string;
  rel?: string;
};

const baseClassName =
  "rounded-2xl font-medium transition disabled:cursor-not-allowed";

const toneClassNames: Record<ActionButtonTone, string> = {
  primary:
    "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-400",
  secondary:
    "border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:text-slate-400",
  danger:
    "border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:text-rose-300",
  link:
    "border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:border-slate-200 disabled:text-slate-400"
};

const sizeClassNames: Record<ActionButtonSize, string> = {
  md: "px-4 py-3 text-sm",
  sm: "px-3 py-2 text-xs"
};

function getClassName(tone: ActionButtonTone, size: ActionButtonSize, className?: string) {
  return [baseClassName, toneClassNames[tone], sizeClassNames[size], className]
    .filter(Boolean)
    .join(" ");
}

export function ActionButton(props: ButtonProps | LinkProps) {
  const tone = props.tone ?? "secondary";
  const size = props.size ?? "md";
  const className = getClassName(tone, size, props.className);

  if ("href" in props && props.href) {
    const { children, href, target, rel } = props;
    return (
      <a href={href} target={target} rel={rel} className={className}>
        {children}
      </a>
    );
  }

  const { children, type = "button", ...buttonProps } = props as ButtonProps;
  return (
    <button {...buttonProps} type={type} className={className}>
      {children}
    </button>
  );
}
