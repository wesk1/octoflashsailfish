const fs = require('fs');
const os = require('os');

const baseDirectory = os.homedir() + "/OctoPrint/plugins/flashsailfish/firmwares";
const downloadProcessPanel = $("#downloadProcessPanel");
const downloadProgressBar = $("#downloadProgressBar");

// Check if the directory exists, and create it if not
if (!fs.existsSync(baseDirectory)) {
    fs.mkdirSync(baseDirectory, { recursive: true });
}
$(function () {
    function FlashsailfishViewModel(parameters) {
        const self = this;

        self.settings = parameters[0];

        self.boards = ko.observableArray([]);
        self.board = ko.observable();
        self.versions = ko.observableArray([]);
        self.version = ko.observable();
        self.firmware_path = ko.observable();
        self.selectedFirmwareDescription = ko.observable("");
        self.firmware_info = undefined;

        // Observable to store the uploaded filename
        self.uploadedFilename = ko.observable("");

        // Observable for displaying the selected filename
        self.selectedFileName = ko.observable("");

        // Function to update the label with the selected filename
        self.updateSelectedFileName = function () {
            const fileInput = document.getElementById("fileInput");

            // Ensure that the event handler is triggered when the file selection changes
            $(fileInput).on("change", function () {
                // Update the label with the selected filename
                self.selectedFileName(this.files.length > 0 ? this.files[0].name : "");
            });
        };

        // Separate function to handle file upload
        self.uploadFirmware = function (url, successCallback, errorCallback) {
            const fileInput = document.getElementById("fileInput");

            // Check if a file is selected
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];

                // Create a FormData object to send the file
                const formData = new FormData();
                formData.append("file", file);

                // Make a POST request to the server to handle the file upload
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
        };

        // Modify Upload_firmware to initiate the firmware flashing process
        self.Upload_firmware = function () {
            // Use the uploadFirmware function to handle the file upload
            self.uploadFirmware("/plugin/flashsailfish/firmwares/*.hex", function (response) {
                console.log("File upload successful:", response);

                // Check if the response contains the uploaded filename
                if (response && response.filename) {
                    // Update the view model with the uploaded filename
                    self.uploadedFilename(response.filename);
                }

                // Add any further actions after a successful upload
                // (For example, initiate the firmware flashing process here)
            }, function (error) {
                console.error("File upload failed:", error);
                // Handle the error, if necessary
            });
        };

        self.refresh_firmware_xml = function () {
            $.getJSON("/plugin/flashsailfish/firmware_info", function (data) {
                self.firmware_info = data;
                self.refresh_observables();
            });
        };

        self.refresh_observables = function () {
            self.boards.removeAll();  // Clear the array first
            self.versions.removeAll();  // Clear the versions array
            if (self.firmware_info !== undefined) {
                console.log("Firmware Info:", self.firmware_info);  // Add this line for debugging
                for (const board in self.firmware_info) {
                    if (self.firmware_info.hasOwnProperty(board)) {
                        console.log("Adding board:", board);  // Add this line for debugging
                        self.boards.push(board);
                    }
                }

                console.log("Sorted Boards:", self.boards());  // Add this line for debugging

                self.boards.sort();
            }
        };

        self.board.subscribe(function (newBoard) {
            self.versions.removeAll();  // Clear the versions array first
            if (newBoard !== undefined && self.firmware_info !== undefined) {
                const firmwareVersions = self.firmware_info[newBoard]?.firmwares;  // Fix: Access the 'firmwares' property using optional chaining

                if (firmwareVersions !== undefined) {
                    for (const version in firmwareVersions) {
                        if (firmwareVersions.hasOwnProperty(version)) {
                            self.versions.push(version);
                        }
                    }

                    console.log("Sorted Versions:", self.versions());  // Add this line for debugging

                    self.versions.sort();
                }
            }
        });

        self.version.subscribe(function (newVersion) {
            if (newVersion !== undefined && self.firmware_info !== undefined) {
                const selectedBoard = self.board();
                const firmwareInfo = self.firmware_info[selectedBoard];

                if (firmwareInfo !== undefined) {
                    const firmwareVersions = firmwareInfo.firmwares;

                    if (firmwareVersions !== undefined) {
                        const selectedFirmware = firmwareVersions[newVersion];

                        if (selectedFirmware !== undefined && selectedFirmware.description !== undefined) {
                            self.selectedFirmwareDescription(selectedFirmware.description);
                        } else {
                            self.selectedFirmwareDescription("");
                        }
                    }
                }
            }
        });

self.downloadFirmware = function () {
    // Check if board and version are selected
    if (self.board() && self.version()) {
        const selectedBoard = self.board();
        const selectedVersion = self.version();
		// Show the download process panel
		downloadProcessPanel.show();

        // Get the firmware info
        const firmwareInfo = self.firmware_info[selectedBoard];

        // Check if the firmware info is available
        if (firmwareInfo && firmwareInfo.firmwares) {
            const firmwareVersions = firmwareInfo.firmwares;

            // Check if the selected version exists in the firmware info
            if (firmwareVersions[selectedVersion]) {
                const relPath = firmwareVersions[selectedVersion].relpath;

                // Check if relpath is available
                if (relPath) {
                    // Get the base URL from the plugin settings
                    const baseUrl = self.settings.settings.plugins.flashsailfish.url();

                    // Remove the last segment (firmware.xml) from the base URL
                    const baseUrlWithoutXml = baseUrl.replace(/\/firmware.xml$/, '');

                    // Construct the download URL
                    const downloadUrl = `${baseUrlWithoutXml}/${relPath}`;

                    // Fetch the firmware content
                    fetch(downloadUrl)
						.then(response => {
							const contentLength = response.headers.get('content-length');
							let receivedBytes = 0;
							
							// Update progress bar based on download progress
							const updateProgress = () => {
							const progress = (receivedBytes / contentLength) * 100;
							downloadProgressBar.width(progress + "%");
							downloadProgressBar.text(progress.toFixed(2) + "%");
						};
						// Stream the response and update progress
						const reader = response.body.getReader();
						return new ReadableStream({
							start(controller) {
							const pump = () => reader.read().then(({ done, value }) => {
								if (done) {
								controller.close();
								return;
                        }
                        controller.enqueue(value);
                        receivedBytes += value.length;
                        updateProgress();
                        pump();
                    });
                    pump();
                }
            });
        })
        .then(blob => {
            // Hide the download process panel when the download is complete
            downloadProcessPanel.hide();
                            // Save the firmware to the base directory
                            const filename = `${baseDirectory}/${selectedBoard}_${selectedVersion}.hex`;
                            const a = document.createElement('a');
                            a.href = URL.createObjectURL(blob);
                            a.download = filename;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                        })
                        .catch(error => {
                            console.error("Error fetching firmware:", error);
                        });
                } else {
                    console.error("Relpath not available for the selected firmware version.");
                }
            } else {
                console.error("Selected version not found in firmware info.");
            }
        } else {
            console.error("Firmware info not available for the selected board.");
        }
    } else {
        console.warn("Board and version must be selected before downloading firmware.");
    }
};




        self.fetch_firmware_info = function () {
            $.getJSON("/plugin/flashsailfish/firmware_info", function (data) {
                self.firmware_info = data;
                self.refresh_observables();
            });
        };

        self.onSettingsShown = self.fetch_firmware_info;

        // Call the function to set up the file input change event
        self.updateSelectedFileName();
    }

    // view model class, parameters for constructor, container to bind to
    OCTOPRINT_VIEWMODELS.push([
        FlashsailfishViewModel,
        ["settingsViewModel"],
        ["#settings_plugin_flashsailfish"]
    ]);
});
