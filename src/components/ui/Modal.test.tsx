import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "./Modal";

describe("Modal", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <Modal open={false} onClose={vi.fn()} title="Hi">
        <p>content</p>
      </Modal>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders title and children when open", () => {
    render(
      <Modal open onClose={vi.fn()} title="Hi">
        <p>content</p>
      </Modal>
    );
    expect(screen.getByText("Hi")).toBeInTheDocument();
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("calls onClose on Escape, on backdrop click, and on the close button — but not on a click inside the content", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Hi">
        <p>content</p>
      </Modal>
    );

    await user.click(screen.getByText("content"));
    expect(onClose).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledTimes(2);

    // backdrop is the outer fixed-inset div — click its text content's grandparent
    await user.click(screen.getByText("content").closest(".fixed") as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
