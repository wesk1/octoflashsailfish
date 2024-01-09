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

        // Modify flash_firmware to initiate the firmware flashing process
        self.flash_firmware = function () {
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

        // Function to refresh firmware information
        self.fetch_firmware_info = function () {
            $.getJSON("/plugin/flashsailfish/firmware_info", function (data) {
                self.firmware_info = data;
                self.refresh_observables();
            });
        };

        // Function to refresh observable arrays
        self.refresh_observables = function () {
            self.boards.removeAll();
            self.versions.removeAll();

            if (self.firmware_info !== undefined) {
                console.log("Firmware Info:", self.firmware_info);
                for (const board in self.firmware_info) {
                    if (self.firmware_info.hasOwnProperty(board)) {
                        console.log("Adding board:", board);
                        self.boards.push(board);
                    }
                }

                console.log("Sorted Boards:", self.boards());
                self.boards.sort();
            }
        };

        // Call the function to set up the file input change event
        self.updateSelectedFileName();

        // Move the download_firmware function outside the fetch_firmware_info function
        self.download_firmware = function () {
            // Get the selected board and version
            const selectedBoard = self.board();
            const selectedVersion = self.version();

            // Check if a board and version are selected
            if (selectedBoard && selectedVersion) {
                // Make a GET request to retrieve the firmware information
                $.getJSON("/plugin/flashsailfish/firmware_info", function (data) {
                    // Get the firmware information for the selected board and version
                    const firmwareInfo = data[selectedBoard];
                    const selectedFirmware = firmwareInfo.firmwares[selectedVersion];

                    // Check if the firmware information is available
                    if (selectedFirmware) {
                        // Get the relative path for the firmware
                        const relpath = selectedFirmware.relpath;

                        // Construct the complete URL for the firmware download
                        const firmwareUrl = "https://s3.amazonaws.com/sailfish-firmware.polar3d.com/release/" + relpath;

                        // Set the destination directory for the firmware download (replace "~" with the absolute path)
                        const destinationDir = "/opt/octoprint/flashsailfish/firmwares";

                        // Make a POST request to initiate the firmware download
                        $.ajax({
                            type: "POST",
                            url: "/plugin/flashsailfish/download_firmware",
                            contentType: "application/json",
                            data: JSON.stringify({ xml_path: firmwareUrl, destination_dir: destinationDir }),
                            success: function (response) {
                                console.log("Firmware download initiated:", response);
                                // Add any further actions after a successful firmware download initiation
                            },
                            error: function (error) {
                                console.error("Firmware download initiation failed:", error);
                                // Handle the error, if necessary
                            }
                        });
                    } else {
                        console.warn("Selected firmware information not available");
                    }
                });
            } else {
                console.warn("No board or version selected");
            }
        };
    }

    // view model class, parameters for constructor, container to bind to
    OCTOPRINT_VIEWMODELS.push([
        FlashsailfishViewModel,
        ["settingsViewModel"],
        ["#settings_plugin_flashsailfish"]
    ]);
});
