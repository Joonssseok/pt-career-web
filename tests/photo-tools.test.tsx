/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { PhotoTools } from "@/components/profile-editor/PhotoTools";
const mockCropMount = jest.fn();
jest.mock("@/components/profile-editor/PhotoCropDialog", () => {
  const React = require("react");
  return {
    PhotoCropDialog: (props: {
      current: unknown;
      onApply: (crop: unknown) => void;
      onClose: () => void;
      error: string;
    }) => {
      React.useEffect(() => {
        mockCropMount({ crop: props.current });
      }, []);
      return React.createElement(
        "div",
        { role: "dialog" },
        React.createElement("button", { onClick: props.onClose }, "취소"),
        props.error && React.createElement("p", { role: "alert" }, props.error),
        React.createElement(
          "button",
          { onClick: () => props.onApply(props.current) },
          "적용",
        ),
      );
    },
  };
});
beforeEach(() => {
  mockCropMount.mockClear();
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
});
const crop = { x: 10, y: 20, width: 60, height: 70 };
function setup() {
  const onChange = jest.fn(() => true);
  render(
    <PhotoTools
      src="/original.gif"
      widthPercent={60}
      crop={crop}
      naturalAspect={4 / 3}
      editable
      onChange={onChange}
      onDelete={jest.fn()}
    />,
  );
  return onChange;
}
test("passes the saved crop to the dialog; cancel leaves it unchanged", () => {
  const onChange = setup();
  fireEvent.click(screen.getByRole("button", { name: "자르기", exact: true }));
  expect(mockCropMount).toHaveBeenCalledWith({ crop });
  fireEvent.click(screen.getByRole("button", { name: "취소" }));
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).toBeNull();
});
test("applies crop coordinates without replacing the original and can reopen safely", () => {
  const onChange = setup();
  fireEvent.click(screen.getByRole("button", { name: "자르기", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "적용" }));
  expect(onChange).toHaveBeenCalledWith({ crop });
  fireEvent.click(screen.getByRole("button", { name: "자르기", exact: true }));
  expect(mockCropMount).toHaveBeenCalledTimes(2);
});
test("original restore removes both presentation overrides", () => {
  const onChange = setup();
  fireEvent.click(screen.getByRole("button", { name: "원본 복원" }));
  expect(onChange).toHaveBeenCalledWith({ widthPercent: null, crop: null });
});

test("keeps the pending crop open if saving temporarily rejects application", () => {
  const onChange = setup();
  onChange.mockReturnValueOnce(false);
  fireEvent.click(screen.getByRole("button", { name: "자르기", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "적용" }));
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(screen.getByRole("alert").textContent).toContain("다시 적용");
  fireEvent.click(screen.getByRole("button", { name: "적용" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(onChange).toHaveBeenLastCalledWith({ crop });
});
