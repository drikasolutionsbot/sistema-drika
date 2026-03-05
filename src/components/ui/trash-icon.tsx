import React, { useId } from "react";
import { cn } from "@/lib/utils";

interface TrashIconProps {
  className?: string;
  size?: number;
}

const TrashIcon = ({ className, size }: TrashIconProps) => {
  const maskId = useId();
  const s = size || 16;

  return (
    <span
      className={cn(
        "group/trash relative inline-flex flex-col items-center justify-center overflow-hidden",
        className
      )}
      style={{ width: s, height: s }}
    >
      {/* Document icon - hidden, appears on hover */}
      <svg
        viewBox="0 0 1.625 1.625"
        className="absolute fill-current transition-all duration-300 opacity-0 -translate-y-full group-hover/trash:opacity-100 group-hover/trash:translate-y-0 group-hover/trash:animate-[spin_1.4s_ease-in-out]"
        style={{ width: s * 0.55, height: s * 0.55, top: '10%' }}
      >
        <path d="M.471 1.024v-.52a.1.1 0 0 0-.098.098v.618c0 .054.044.098.098.098h.487a.1.1 0 0 0 .098-.099h-.39c-.107 0-.195 0-.195-.195" />
        <path d="M1.219.601h-.163A.1.1 0 0 1 .959.504V.341A.033.033 0 0 0 .926.309h-.26a.1.1 0 0 0-.098.098v.618c0 .054.044.098.098.098h.487a.1.1 0 0 0 .098-.099v-.39a.033.033 0 0 0-.032-.033" />
        <path d="m1.245.465-.15-.15a.02.02 0 0 0-.016-.006.023.023 0 0 0-.023.022v.108c0 .036.029.065.065.065h.107a.023.023 0 0 0 .023-.023.02.02 0 0 0-.007-.016" />
      </svg>

      {/* Lid */}
      <svg
        fill="none"
        viewBox="0 0 39 7"
        className="origin-right transition-transform duration-300 group-hover/trash:rotate-90"
        style={{ width: s * 0.7 }}
      >
        <line strokeWidth={4} stroke="currentColor" y2={5} x2={39} y1={5} />
        <line strokeWidth={3} stroke="currentColor" y2="1.5" x2="26.0357" y1="1.5" x1={12} />
      </svg>

      {/* Can body */}
      <svg
        fill="none"
        viewBox="0 0 33 39"
        style={{ width: s * 0.6 }}
      >
        <mask fill="white" id={maskId}>
          <path d="M0 0H33V35C33 37.2091 31.2091 39 29 39H4C1.79086 39 0 37.2091 0 35V0Z" />
        </mask>
        <path
          mask={`url(#${maskId})`}
          fill="currentColor"
          d="M0 0H33H0ZM37 35C37 39.4183 33.4183 43 29 43H4C-0.418278 43 -4 39.4183 -4 35H4H29H37ZM4 43C-0.418278 43 -4 39.4183 -4 35V0H4V35V43ZM37 0V35C37 39.4183 33.4183 43 29 43V35V0H37Z"
        />
        <path strokeWidth={4} stroke="currentColor" d="M12 6L12 29" />
        <path strokeWidth={4} stroke="currentColor" d="M21 6V29" />
      </svg>
    </span>
  );
};

export default TrashIcon;
