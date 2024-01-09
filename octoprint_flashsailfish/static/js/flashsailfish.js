$(function () {
    class FlashsailfishViewModel {
        constructor(parameters) {
            const [settings] = parameters;

            this.settings = settings;
            this.boards = ko.observableArray([]);
            this.board = ko.observable();
            this.versions = ko.observableArray([]);
            this.version = ko.observable();
            this.firmware_path = ko.observable();
            this.selectedFirmwareDescription = ko.observable("");
            this.firmware_info = undefined;

            this.uploadedFilename = ko.observable("");
            this.selectedFileName = ko.observable("");

            this.updateSelectedFileName();
        }

        updateSelectedFileName() {
            const fileInput = document.getElementById("fileInput");

            $(fileInput).on("change", function () {
                this.selectedFileName(this.files.length > 0 ? this.files[0].name : "");
            });
        }

        uploadFirmware(url, successCallback, errorCallback) {
            const fileInput = document.getElementById("fileInput");

            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];
                const formData = new FormData();
                formData.append("file", file);

                $.ajax({
                    type: "POST",
                    url: url,
                    data: formData,
                    processData: false,
                    contentType: false,
                    success: successCallback,
                    error: errorCallback
                });
            } else {
                console.warn("No file selected for upload");
            }
        }

        flash_firmware() {
            this.uploadFirmware("/plugin/flashsailfish/firmwares/*.hex", (response) => {
                console.log("File upload successful:", response);

                if (response && response.filename) {
                    this.uploadedFilename(response.filename);
                }
            }, (error) => {
                console.error("File upload failed:", error);
            });
        }

        fetch_firmware_info() {
            const fetchData = () => {
                $.getJSON("/plugin/flashsailfish/firmware_info", (data) => {
                    this.firmware_info = data;
                    this.refresh_observables();
                });
            };

            fetchData();
            this.onSettingsShown = fetchData;
        }

        refresh_observables() {
            this.boards.removeAll();
            this.versions.removeAll();

            if (this.firmware_info !== undefined) {
                for (const board in this.firmware_info) {
                    if (this.firmware_info.hasOwnProperty(board)) {
                        this.boards.push(board);
                    }
                }

                this.boards.sort();
            }
        }

        board.subscribe((newBoard) => {
            this.versions.removeAll();
            if (newBoard !== undefined && this.firmware_info !== undefined) {
                const firmwareVersions = this.firmware_info[newBoard]?.firmwares;

                if (firmwareVersions !== undefined) {
                    for (const version in firmwareVersions) {
                        if (firmwareVersions.hasOwnProperty(version)) {
                            this.versions.push(version);
                        }
                    }

                    this.versions.sort();
                }
            }
        });

        version.subscribe((newVersion) => {
            if (newVersion !== undefined && this.firmware_info !== undefined) {
                const selectedBoard = this.board();
                const firmwareInfo = this.firmware_info[selectedBoard];

                if (firmwareInfo !== undefined) {
                    const firmwareVersions = firmwareInfo.firmwares;

                    if (firmwareVersions !== undefined) {
                        const selectedFirmware = firmwareVersions[newVersion];

                        if (selectedFirmware !== undefined && selectedFirmware.description !== undefined) {
                            this.selectedFirmwareDescription(selectedFirmware.description);
                        } else {
                            this.selectedFirmwareDescription("");
                        }
                    }
                }
            }
        });

        fetch_firmware_info = () => {
            $.getJSON("/plugin/flashsailfish/firmware_info", (data) => {
                this.firmware_info = data;
                this.refresh_observables();
            });
        };

        onSettingsShown = fetch_firmware_info;

        download_firmware() {
            const selectedBoard = this.board();
            const selectedVersion = this.version();

            if (selectedBoard && selectedVersion) {
                $.getJSON("/plugin/flashsailfish/firmware_info", (data) => {
                    const firmwareInfo = data[selectedBoard];
                    const selectedFirmware = firmwareInfo.firmwares[selectedVersion];

                    if (selectedFirmware) {
                        const relpath = selectedFirmware.relpath;
                        const firmwareUrl = `https://s3.amazonaws.com/sailfish-firmware.polar3d.com/release/${relpath}`;
                        const destinationDir = "/opt/octoprint/flashsailfish/firmwares";

                        $.ajax({
                            type: "POST",
                            url: "/plugin/flashsailfish/download_firmware",
                            contentType: "application/json",
                            data: JSON.stringify({ xml_path: firmwareUrl, destination_dir: destinationDir }),
                            success: (response) => {
                                console.log("Firmware download initiated:", response);
                            },
                            error: (error) => {
                                console.error("Firmware download initiation failed:", error);
                            }
                        });
                    } else {
                        console.warn("Selected firmware information not available");
                    }
                });
            } else {
                console.warn("No board or version selected");
            }
        }
    }

    OCTOPRINT_VIEWMODELS.push([
        FlashsailfishViewModel,
        ["settingsViewModel"],
        ["#settings_plugin_flashsailfish"]
    ]);
});
