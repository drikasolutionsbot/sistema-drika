import React from "react";
import styled from "styled-components";
import { cn } from "@/lib/utils";

interface TrashIconProps {
  className?: string;
  size?: number;
}

const TrashIcon = ({ className, size }: TrashIconProps) => {
  const s = size || 16;

  return (
    <StyledWrapper
      className={cn("inline-flex items-center justify-center", className)}
      style={{ width: s, height: s }}
      $size={s}
    >
      <button
        type="button"
        aria-label="Delete"
        className="delete-button"
        tabIndex={-1}
        style={{ pointerEvents: "none" }}
      >
        <svg className="trash-svg" viewBox="0 -10 64 74" xmlns="http://www.w3.org/2000/svg">
          <g id="trash-can">
            <rect x={16} y={24} width={32} height={30} rx={3} ry={3} fill="currentColor" opacity={0.85} />
            <g className="lid-group">
              <rect x={12} y={12} width={40} height={6} rx={2} ry={2} fill="currentColor" />
              <rect x={26} y={8} width={12} height={4} rx={2} ry={2} fill="currentColor" />
            </g>
          </g>
        </svg>
      </button>
    </StyledWrapper>
  );
};

const StyledWrapper = styled.span<{ $size: number }>`
  .delete-button {
    position: relative;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 1em;
    transition: transform 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .trash-svg {
    width: ${(p) => p.$size}px;
    height: ${(p) => p.$size}px;
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    overflow: visible;
  }

  .lid-group {
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    transform-origin: 12px 18px;
  }

  *:hover > &,
  &:hover {
    .lid-group {
      transform: rotate(-28deg) translateY(2px);
    }

    .trash-svg {
      transform: scale(1.08) rotate(3deg);
    }
  }

  *:active > &,
  &:active {
    .lid-group {
      transform: rotate(-12deg) scale(0.98);
    }

    .trash-svg {
      transform: scale(0.96) rotate(-1deg);
    }
  }
`;

export default TrashIcon;
