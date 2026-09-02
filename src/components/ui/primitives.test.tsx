import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";
import { Input, Select, Textarea, Label } from "./Input";

describe("Button", () => {
  it("renders children, fires onClick, and respects disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click me</Button>);
    await user.click(screen.getByRole("button", { name: "Click me" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not fire onClick when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Click me
      </Button>
    );
    await user.click(screen.getByRole("button", { name: "Click me" }));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("Input/Select/Textarea/Label", () => {
  it("forwards value/onChange for a text input", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Input value="" onChange={onChange} placeholder="type here" />);
    await user.type(screen.getByPlaceholderText("type here"), "a");
    expect(onChange).toHaveBeenCalled();
  });

  it("renders select options", () => {
    render(
      <Select value="b" onChange={vi.fn()}>
        <option value="a">A</option>
        <option value="b">B</option>
      </Select>
    );
    expect(screen.getByRole("combobox")).toHaveValue("b");
  });

  it("renders a textarea and a label", () => {
    render(
      <>
        <Label>Notes</Label>
        <Textarea value="hello" onChange={vi.fn()} />
      </>
    );
    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(screen.getByDisplayValue("hello")).toBeInTheDocument();
  });
});
