function cameraName(label) {
    let clean = label.replace(/\s*\([0-9a-f]+(:[0-9a-f]+)?\)\s*$/, '');
    return clean || label || null;
}

class MediaError extends Error {
    constructor(type) {
        super(`Cannot access video stream (${type}).`);
        this.type = type;
    }
}

//选择摄像头方案
const narrowDownFacingMode = async (camera) => {
    // Modern phones often have multipe front/rear cameras.
    // Sometimes special purpose cameras like the wide-angle camera are picked
    // by default. Those are not optimal for scanning QR codes but standard
    // media constraints don't allow us to specify which camera we want exactly.
    // However, explicitly picking the first entry in the list of all videoinput
    // devices for as the default front camera and the last entry as the default
    // rear camera seems to be a workaround.
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter(
        ({ kind }) => kind === 'videoinput'
    );

    if (devices.length > 2) {
        const frontCamera = devices[0];
        const rearCamera = devices[devices.length - 1];

        switch (camera) {
            case 'auto':
                return { deviceId: { exact: rearCamera.deviceId } };
            case 'rear':
                return { deviceId: { exact: rearCamera.deviceId } };
            case 'front':
                return { deviceId: { exact: frontCamera.deviceId } };
            default:
                return undefined;
        }
    } else {
        switch (camera) {
            case 'auto':
                return { facingMode: { ideal: 'environment' } };
            case 'rear':
                return { facingMode: { exact: 'environment' } };
            case 'front':
                return { facingMode: { exact: 'user' } };
            default:
                return undefined;
        }
    }
};

class Camera {
    constructor(id, name) {
        this.id = id;
        this.name = name;
        this._stream = null;
    }

    async start(camera) {
        if(!camera){
            camera="auto"
        }
        let vopts = await narrowDownFacingMode(camera);
        console.log(camera)
        console.log(vopts)
        let opts = {
            width: { min: 360, ideal: 640, max: 1920 },
            height: { min: 240, ideal: 480, max: 1080 },
        };
        opts = Object.assign({}, opts, vopts);
        let constraints = {
            audio: false,
            video: opts,
        };
        console.log(constraints)
        this._stream = await Camera._wrapErrors(async () => {
            return await navigator.mediaDevices.getUserMedia(constraints);
        });

        return this._stream;
    }

    stop() {
        if (!this._stream) {
            return;
        }

        for (let stream of this._stream.getVideoTracks()) {
            stream.stop();
        }

        this._stream = null;
    }

    static async getCameras() {
        await this._ensureAccess();
        //得到所有的音频输出设备
        const devices = (await navigator.mediaDevices.enumerateDevices()).filter(
            ({ kind }) => kind === 'videoinput'
        );
        let res = [];
        //第一个就是前置摄像头，最后一个就是后置摄像头
        for (let i = 0; i < devices.length; i++) {
            let d = devices[i];
            if (i === 0) {
                //前置摄像头
                res.push(new Camera(d.deviceId, 'front'));
            } else if (i === devices.length - 1) {
                //后置摄像头
                res.push(new Camera(d.deviceId, 'rear'));
            } else {
                //辅助摄像头
                res.push(new Camera(d.deviceId, 'auxiliary'));
            }
        }
        return res;
    }

    static async _ensureAccess() {
        return await this._wrapErrors(async () => {
            let access = await navigator.mediaDevices.getUserMedia({ video: true });
            for (let stream of access.getVideoTracks()) {
                stream.stop();
            }
        });
    }

    static async _wrapErrors(fn) {
        try {
            return await fn();
        } catch (e) {
            if (e.name) {
                throw new MediaError(e.name);
            } else {
                throw e;
            }
        }
    }
}

module.exports = Camera;
