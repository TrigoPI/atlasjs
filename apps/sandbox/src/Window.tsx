import type React from "react";
import type { ComponentProps, ReactNode } from "react";

export const Window: React.FC<ComponentProps<"div">> = ({
  ref,
  ...props
}: ComponentProps<"div">): ReactNode => {
  return (
    <div {...props}>
      <div ref={ref}></div>
    </div>
  );
};
