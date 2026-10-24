import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../utils/cropUtils';
import ImageCropper from './Rustic/ImageCropper';

jest.mock('react-easy-crop', () => ({ __esModule: true, default: jest.fn(() => null) }));
jest.mock('../utils/cropUtils', () => ({ __esModule: true, default: jest.fn() }));

let container, root, onCancel, onCropComplete;
const imageSrc = '/fixture-image.png';
const pixelCrop = { x: 12, y: 24, width: 300, height: 200 };
const cropProps = () => Cropper.mock.calls.at(-1)[0];
const slider = () => container.querySelector('input[type="range"]');
const button = name => [...container.querySelectorAll('button')].find(element => element.textContent.includes(name));

beforeEach(async () => {
    jest.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    onCancel = jest.fn();
    onCropComplete = jest.fn();
    await act(async () => root.render(<ImageCropper imageSrc={imageSrc} onCancel={onCancel} onCropComplete={onCropComplete} />));
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
});

test('Image zoom labels the existing native range and preserves its limits and crop defaults', () => {
    expect(slider().labels).toHaveLength(1);
    expect(slider().labels[0].textContent).toBe('Image zoom');
    expect(slider().value).toBe('1');
    expect(slider().min).toBe('1');
    expect(slider().max).toBe('3');
    expect(slider().step).toBe('0.1');
    expect(slider().tabIndex).toBe(0);
    expect(document.activeElement).toBe(slider());
    expect(cropProps()).toMatchObject({ image: imageSrc, crop: { x: 0, y: 0 }, zoom: 1, aspect: 3 / 2 });
});

test('the range and crop-stage zoom callbacks keep the same numeric zoom and crop state', async () => {
    await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(slider(), '2.3');
        slider().dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(cropProps().zoom).toBe(2.3);
    await act(async () => cropProps().onZoomChange(1.7));
    expect(slider().value).toBe('1.7');
    expect(cropProps().zoom).toBe(1.7);
    await act(async () => cropProps().onCropChange({ x: 15, y: -10 }));
    expect(cropProps().crop).toEqual({ x: 15, y: -10 });
    expect(getCroppedImg).not.toHaveBeenCalled();
    expect(onCropComplete).not.toHaveBeenCalled();
});

test('Use cropped image forwards the same source, pixel crop and completed blob exactly once', async () => {
    const blob = new Blob(['fixture-crop'], { type: 'image/jpeg' });
    let finish;
    getCroppedImg.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    await act(async () => cropProps().onCropComplete({ x: 4, y: 8, width: 50, height: 50 }, pixelCrop));
    const confirm = button('Use cropped image');
    expect(confirm.type).toBe('button');
    await act(async () => confirm.click());
    expect(getCroppedImg.mock.calls).toEqual([[imageSrc, pixelCrop]]);
    expect(onCropComplete).not.toHaveBeenCalled();
    await act(async () => finish(blob));
    expect(onCropComplete.mock.calls).toEqual([[blob, pixelCrop]]);
    expect(onCancel).not.toHaveBeenCalled();
});

test.each(['Cancel', 'Escape'])('%s dismisses without producing a crop', async action => {
    await act(async () => {
        if (action === 'Cancel') button('Cancel').click();
        else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(getCroppedImg).not.toHaveBeenCalled();
    expect(onCropComplete).not.toHaveBeenCalled();
});
