import React from 'react';
import ReactDOM from 'react-dom';

import Storage from '../utils/Storage';

import exporters from '../exporters';
import { getExporterByType } from '../exporters';
import packers from '../packers';
import { getPackerByType } from '../packers';
import filters from '../filters';
import { getFilterByType } from '../filters';

import I18 from '../utils/I18';

import {Observer, GLOBAL_EVENT} from '../Observer';

import FileSystem from 'platform/FileSystem';

const STORAGE_OPTIONS_KEY = "pack-options";
const STORAGE_CUSTOM_EXPORTER_KEY = "custom-exporter";

const SOLVER_MODE = {
    SCALE: 'scale',
    AUTO: 'auto',
    MULTI_ATLAS: 'multi-atlas',
    MANUAL: 'manual'
};

let INSTANCE = null;

class PackProperties extends React.Component {
    constructor(props) {
        super(props);

        INSTANCE = this;

        this.onPackerChange = this.onPackerChange.bind(this);
        this.onPropChanged = this.onPropChanged.bind(this);
        this.onExporterChanged = this.onExporterChanged.bind(this);
        this.onExporterPropChanged = this.onExporterPropChanged.bind(this);
        this.forceUpdate = this.forceUpdate.bind(this);
        this.selectSavePath = this.selectSavePath.bind(this);
        this.onSolverModeChange = this.onSolverModeChange.bind(this);
        this.onManualToggle = this.onManualToggle.bind(this);

        this.packOptions = this.loadOptions();
        this.loadCustomExporter();

        window.applyOptionsDefaults = this.applyOptionsDefaults;

        this.state = {
            packer: this.packOptions.packer,
            solverMode: this.packOptions.solverMode || SOLVER_MODE.SCALE,
            manualMode: this.packOptions.manualMode || false
        };

        // Listen for efficiency updates
        Observer.on(GLOBAL_EVENT.EFFICIENCY_UPDATE, this.onEfficiencyUpdate.bind(this));
        Observer.on(GLOBAL_EVENT.SOLVER_PROGRESS, this.onSolverProgress.bind(this));
    }

    static get i() {
        return INSTANCE;
    }

    onEfficiencyUpdate(data) {
        this.setState({ efficiency: data });
    }

    onSolverProgress(data) {
        this.setState({ solverProgress: data });
    }

    setOptions(data) {
        this.packOptions = this.applyOptionsDefaults(data);
        this.saveOptions();
        this.refreshPackOptions();
        this.emitChanges();
    }

    loadCustomExporter() {
        let data = Storage.load(STORAGE_CUSTOM_EXPORTER_KEY);
        if(data) {
            let exporter = getExporterByType("custom");
            exporter.allowTrim = data.allowTrim;
            exporter.allowRotation = data.allowRotation;
            exporter.fileExt = data.fileExt;
            exporter.content = data.content;
        }
    }

    loadOptions() {
        return this.applyOptionsDefaults(Storage.load(STORAGE_OPTIONS_KEY));
    }

    applyOptionsDefaults(data) {
        if(!data) data = {};

        data.textureName = data.textureName || "texture";
        data.textureFormat = data.textureFormat || "png";
        data.removeFileExtension = data.removeFileExtension === undefined ? true : data.removeFileExtension;
        data.prependFolderName = data.prependFolderName === undefined ? true : data.prependFolderName;
        data.scale = data.scale || 1;
        data.filter = getFilterByType(data.filter) ? data.filter : filters[0].type;
        
        // Default exporter to Sparrow Starling XML for FNF
        data.exporter = getExporterByType(data.exporter) ? data.exporter : 'Sparrow';
        // Fallback to first exporter if Sparrow not found
        if (!getExporterByType(data.exporter)) {
            data.exporter = exporters[0].type;
        }
        
        data.base64Export = data.base64Export === undefined ? false : data.base64Export;
        data.fileName = data.fileName || "pack-result";
        data.savePath = data.savePath || "";
        data.width = data.width === undefined ? 0 : data.width;
        data.height = data.height === undefined ? 0 : data.height;
        data.fixedSize = data.fixedSize === undefined ? false : data.fixedSize;
        data.powerOfTwo = data.powerOfTwo === undefined ? false : data.powerOfTwo;
        
        // Default padding to 0px for FNF
        data.spritePadding = data.spritePadding === undefined ? 0 : data.spritePadding;
        data.borderPadding = data.borderPadding === undefined ? 0 : data.borderPadding;
        
        // Default rotation OFF
        data.allowRotation = data.allowRotation === undefined ? false : data.allowRotation;
        
        // Default trim ON
        data.allowTrim = data.allowTrim === undefined ? true : data.allowTrim;
        
        data.trimMode = data.trimMode === undefined ? "trim" : data.trimMode;
        data.alphaThreshold = data.alphaThreshold || 0;
        data.detectIdentical = data.detectIdentical === undefined ? true : data.detectIdentical;
        data.sortExportedRows = data.sortExportedRows === undefined ? true : data.sortExportedRows;
        data.packer = getPackerByType(data.packer) ? data.packer : packers[2].type;

        // Solver mode defaults
        data.solverMode = data.solverMode || SOLVER_MODE.SCALE;
        data.manualMode = data.manualMode === undefined ? false : data.manualMode;
        data.disableMaxLimit = data.disableMaxLimit === undefined ? false : data.disableMaxLimit;

        let methodValid = false;
        let packer = getPackerByType(data.packer);
        let packerMethods = Object.keys(packer.methods);
        for(let method of packerMethods) {
            if(method === data.packerMethod) {
                methodValid = true;
                break;
            }
        }

        if(!methodValid) data.packerMethod = packerMethods[0];

        return data;
    }

    saveOptions(force=false) {
        if(PLATFORM === "web" || force) {
            Storage.save(STORAGE_OPTIONS_KEY, this.packOptions);
        }
    }

    componentDidMount() {
        this.updateEditCustomTemplateButton();
        this.emitChanges();
    }

    updatePackOptions() {
        let data = {};

        data.textureName = ReactDOM.findDOMNode(this.refs.textureName).value;
        data.textureFormat = ReactDOM.findDOMNode(this.refs.textureFormat).value;
        data.removeFileExtension = ReactDOM.findDOMNode(this.refs.removeFileExtension).checked;
        data.prependFolderName = ReactDOM.findDOMNode(this.refs.prependFolderName).checked;
        data.base64Export = ReactDOM.findDOMNode(this.refs.base64Export).checked;
        data.scale = Number(ReactDOM.findDOMNode(this.refs.scale).value);
        data.filter = ReactDOM.findDOMNode(this.refs.filter).value;
        data.exporter = ReactDOM.findDOMNode(this.refs.exporter).value;
        data.fileName = ReactDOM.findDOMNode(this.refs.fileName).value;
        data.savePath = ReactDOM.findDOMNode(this.refs.savePath).value;
        data.width = Number(ReactDOM.findDOMNode(this.refs.width).value) || 0;
        data.height = Number(ReactDOM.findDOMNode(this.refs.height).value) || 0;
        data.fixedSize = ReactDOM.findDOMNode(this.refs.fixedSize).checked;
        data.powerOfTwo = ReactDOM.findDOMNode(this.refs.powerOfTwo).checked;
        data.spritePadding = Number(ReactDOM.findDOMNode(this.refs.spritePadding).value) || 0;
        data.borderPadding = Number(ReactDOM.findDOMNode(this.refs.borderPadding).value) || 0;
        data.allowRotation = ReactDOM.findDOMNode(this.refs.allowRotation).checked;
        data.allowTrim = ReactDOM.findDOMNode(this.refs.allowTrim).checked;
        data.trimMode = ReactDOM.findDOMNode(this.refs.trimMode).value;
        data.alphaThreshold = ReactDOM.findDOMNode(this.refs.alphaThreshold).value;
        data.detectIdentical = ReactDOM.findDOMNode(this.refs.detectIdentical).checked;
        data.packer = ReactDOM.findDOMNode(this.refs.packer).value;
        data.packerMethod = ReactDOM.findDOMNode(this.refs.packerMethod).value;
        data.sortExportedRows = ReactDOM.findDOMNode(this.refs.sortExportedRows).value;
        
        // Solver options
        data.solverMode = this.state.solverMode;
        data.manualMode = this.state.manualMode;
        data.disableMaxLimit = ReactDOM.findDOMNode(this.refs.disableMaxLimit) ? ReactDOM.findDOMNode(this.refs.disableMaxLimit).checked : false;

        this.packOptions = this.applyOptionsDefaults(data);
    }

    refreshPackOptions() {
        ReactDOM.findDOMNode(this.refs.textureName).value = this.packOptions.textureName;
        ReactDOM.findDOMNode(this.refs.textureFormat).value = this.packOptions.textureFormat;
        ReactDOM.findDOMNode(this.refs.removeFileExtension).checked = this.packOptions.removeFileExtension;
        ReactDOM.findDOMNode(this.refs.prependFolderName).checked = this.packOptions.prependFolderName;
        ReactDOM.findDOMNode(this.refs.base64Export).checked = this.packOptions.base64Export;
        ReactDOM.findDOMNode(this.refs.scale).value = Number(this.packOptions.scale);
        ReactDOM.findDOMNode(this.refs.filter).value = this.packOptions.filter;
        ReactDOM.findDOMNode(this.refs.exporter).value = this.packOptions.exporter;
        ReactDOM.findDOMNode(this.refs.fileName).value = this.packOptions.fileName;
        ReactDOM.findDOMNode(this.refs.savePath).value = this.packOptions.savePath;
        ReactDOM.findDOMNode(this.refs.width).value = Number(this.packOptions.width) || 0;
        ReactDOM.findDOMNode(this.refs.height).value = Number(this.packOptions.height) || 0;
        ReactDOM.findDOMNode(this.refs.fixedSize).checked = this.packOptions.fixedSize;
        ReactDOM.findDOMNode(this.refs.powerOfTwo).checked = this.packOptions.powerOfTwo;
        ReactDOM.findDOMNode(this.refs.spritePadding).value = Number(this.packOptions.spritePadding) || 0;
        ReactDOM.findDOMNode(this.refs.borderPadding).value = Number(this.packOptions.borderPadding) || 0;
        ReactDOM.findDOMNode(this.refs.allowRotation).checked = this.packOptions.allowRotation;
        ReactDOM.findDOMNode(this.refs.allowTrim).checked = this.packOptions.allowTrim;
        ReactDOM.findDOMNode(this.refs.trimMode).value = this.packOptions.trimMode;
        ReactDOM.findDOMNode(this.refs.alphaThreshold).value = this.packOptions.alphaThreshold || 0;
        ReactDOM.findDOMNode(this.refs.detectIdentical).checked = this.packOptions.detectIdentical;
        ReactDOM.findDOMNode(this.refs.packer).value = this.packOptions.packer;
        ReactDOM.findDOMNode(this.refs.packerMethod).value = this.packOptions.packerMethod;
        ReactDOM.findDOMNode(this.refs.sortExportedRows).value = this.packOptions.sortExportedRows;
        if (ReactDOM.findDOMNode(this.refs.disableMaxLimit)) {
            ReactDOM.findDOMNode(this.refs.disableMaxLimit).checked = this.packOptions.disableMaxLimit;
        }
    }

    getPackOptions() {
        let data = Object.assign({}, this.packOptions);
        data.exporter = getExporterByType(data.exporter);
        data.packer = getPackerByType(data.packer);
        return data;
    }

    emitChanges() {
        Observer.emit(GLOBAL_EVENT.PACK_OPTIONS_CHANGED, this.getPackOptions());
    }

    onPackerChange(e) {
        this.setState({packer: e.target.value});
        this.onPropChanged();
    }

    onPropChanged() {
        this.updatePackOptions();
        this.saveOptions();

        this.emitChanges();
    }

    onExporterChanged() {
        let exporter = getExporterByType(ReactDOM.findDOMNode(this.refs.exporter).value);
        let allowTrimInput = ReactDOM.findDOMNode(this.refs.allowTrim);
        let allowRotationInput = ReactDOM.findDOMNode(this.refs.allowRotation);

        let doRefresh = (allowTrimInput.checked !== exporter.allowTrim) ||
                        (allowRotationInput.checked !== exporter.allowRotation);

        allowTrimInput.checked = exporter.allowTrim;
        allowRotationInput.checked = exporter.allowRotation;

        this.updateEditCustomTemplateButton();

        this.onExporterPropChanged();
        if(doRefresh) this.onPropChanged();
    }

    updateEditCustomTemplateButton() {
        let exporter = getExporterByType(ReactDOM.findDOMNode(this.refs.exporter).value);
        ReactDOM.findDOMNode(this.refs.editCustomFormat).style.visibility = exporter.type === "custom" ? "visible" : "hidden";
    }

    onExporterPropChanged() {
        this.updatePackOptions();
        this.saveOptions();

        Observer.emit(GLOBAL_EVENT.PACK_EXPORTER_CHANGED, this.getPackOptions());
    }

    forceUpdate(e) {
        if(e) {
            let key = e.keyCode || e.which;
            if (key === 13) this.onPropChanged();
        }
    }

    startExport() {
        Observer.emit(GLOBAL_EVENT.START_EXPORT);
    }

    editCustomExporter() {
        Observer.emit(GLOBAL_EVENT.SHOW_EDIT_CUSTOM_EXPORTER);
    }

    selectSavePath() {
        let dir = FileSystem.selectFolder();
        if(dir) {
            ReactDOM.findDOMNode(this.refs.savePath).value = dir;
            this.onExporterPropChanged();
        }
    }

    clearOrder() {
        window.__sparrow_order = undefined;
    }

    onSolverModeChange(mode) {
        this.setState({ solverMode: mode });
        this.packOptions.solverMode = mode;
        this.saveOptions();
        this.emitChanges();
    }

    onManualToggle() {
        const newManualMode = !this.state.manualMode;
        this.setState({ manualMode: newManualMode });
        this.packOptions.manualMode = newManualMode;
        this.saveOptions();
        this.emitChanges();
    }

    getSolverModeLabel(mode) {
        switch(mode) {
            case SOLVER_MODE.SCALE: return 'SCALE';
            case SOLVER_MODE.AUTO: return 'AUTO';
            case SOLVER_MODE.MULTI_ATLAS: return 'MULTI-ATLAS';
            default: return mode;
        }
    }

    render() {
        let exporter = getExporterByType(this.packOptions.exporter);
        let allowRotation = this.packOptions.allowRotation && exporter.allowRotation;
        let exporterRotationDisabled = exporter.allowRotation ? "" : "disabled";
        let allowTrim = this.packOptions.allowTrim && exporter.allowTrim;
        let exporterTrimDisabled = exporter.allowTrim ? "" : "disabled";
        
        const { solverMode, manualMode, efficiency, solverProgress } = this.state;

        return (
            <div className="props-list back-white">
                <div className="pack-properties-containter">
                    {/* Smart Size Solver Section */}
                    <div className="solver-section" style={{ marginBottom: '15px', padding: '10px', borderBottom: '1px solid #ccc' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Smart Size Solver</span>
                            <label style={{ display: 'flex', alignItems: 'center', fontSize: '12px', cursor: 'pointer' }}>
                                <span style={{ marginRight: '5px' }}>Manual</span>
                                <input 
                                    type="checkbox" 
                                    checked={manualMode} 
                                    onChange={this.onManualToggle}
                                    style={{ cursor: 'pointer' }}
                                />
                            </label>
                        </div>
                        
                        {!manualMode && (
                            <>
                                <div className="solver-mode-toggle" style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
                                    <button 
                                        className={`mode-btn ${solverMode === SOLVER_MODE.SCALE ? 'active' : ''}`}
                                        onClick={() => this.onSolverModeChange(SOLVER_MODE.SCALE)}
                                        style={{ 
                                            flex: 1, 
                                            padding: '8px 5px', 
                                            border: '1px solid #888', 
                                            background: solverMode === SOLVER_MODE.SCALE ? '#4a90d9' : '#fff',
                                            color: solverMode === SOLVER_MODE.SCALE ? '#fff' : '#333',
                                            cursor: 'pointer',
                                            fontSize: '11px',
                                            fontWeight: 'bold'
                                        }}
                                    >
                                        SCALE
                                    </button>
                                    <button 
                                        className={`mode-btn ${solverMode === SOLVER_MODE.AUTO ? 'active' : ''}`}
                                        onClick={() => this.onSolverModeChange(SOLVER_MODE.AUTO)}
                                        style={{ 
                                            flex: 1, 
                                            padding: '8px 5px', 
                                            border: '1px solid #888', 
                                            background: solverMode === SOLVER_MODE.AUTO ? '#4a90d9' : '#fff',
                                            color: solverMode === SOLVER_MODE.AUTO ? '#fff' : '#333',
                                            cursor: 'pointer',
                                            fontSize: '11px',
                                            fontWeight: 'bold'
                                        }}
                                    >
                                        AUTO
                                    </button>
                                    <button 
                                        className={`mode-btn ${solverMode === SOLVER_MODE.MULTI_ATLAS ? 'active' : ''}`}
                                        onClick={() => this.onSolverModeChange(SOLVER_MODE.MULTI_ATLAS)}
                                        style={{ 
                                            flex: 1, 
                                            padding: '8px 5px', 
                                            border: '1px solid #888', 
                                            background: solverMode === SOLVER_MODE.MULTI_ATLAS ? '#4a90d9' : '#fff',
                                            color: solverMode === SOLVER_MODE.MULTI_ATLAS ? '#fff' : '#333',
                                            cursor: 'pointer',
                                            fontSize: '11px',
                                            fontWeight: 'bold'
                                        }}
                                    >
                                        MULTI-ATLAS
                                    </button>
                                </div>
                                
                                <div style={{ fontSize: '11px', color: '#666', marginBottom: '5px' }}>
                                    {solverMode === SOLVER_MODE.SCALE && 'Calcula dimensiones óptimas. Si excede 4096px, escala los sprites.'}
                                    {solverMode === SOLVER_MODE.AUTO && 'Elige automáticamente entre SCALE y MULTI-ATLAS según eficiencia.'}
                                    {solverMode === SOLVER_MODE.MULTI_ATLAS && 'Distribuye sprites en múltiples páginas optimizadas.'}
                                </div>
                                
                                <label style={{ display: 'flex', alignItems: 'center', fontSize: '11px', marginTop: '5px' }}>
                                    <input 
                                        ref="disableMaxLimit" 
                                        type="checkbox" 
                                        className="border-color-gray" 
                                        defaultChecked={this.packOptions.disableMaxLimit}
                                        onChange={this.onPropChanged}
                                        style={{ marginRight: '5px' }}
                                    />
                                    Desactivar límite 4096px
                                </label>
                            </>
                        )}
                        
                        {manualMode && (
                            <div style={{ fontSize: '11px', color: '#666' }}>
                                Modo manual activo. Configure Width y Height manualmente abajo.
                            </div>
                        )}
                        
                        {/* Efficiency indicator */}
                        {efficiency && (
                            <div style={{ 
                                marginTop: '10px', 
                                padding: '8px', 
                                background: '#f0f0f0', 
                                borderRadius: '4px',
                                fontSize: '12px'
                            }}>
                                <div style={{ fontWeight: 'bold' }}>
                                    Eficiencia: {efficiency.efficiency.toFixed(1)}%
                                </div>
                                <div style={{ color: '#666' }}>
                                    {efficiency.width}×{efficiency.height}px
                                    {efficiency.sheets && ` • ${efficiency.sheets} hojas`}
                                    {efficiency.scale && efficiency.scale < 1 && ` • Scale: ${efficiency.scale.toFixed(2)}`}
                                </div>
                                {efficiency.mode === 'auto' && (
                                    <div style={{ fontSize: '10px', color: '#888', marginTop: '3px' }}>
                                        Auto eligió: {efficiency.mode === SOLVER_MODE.SCALE ? 'SCALE' : 'MULTI-ATLAS'}
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {/* Solver progress */}
                        {solverProgress && solverProgress.completedWorkers < solverProgress.totalWorkers && (
                            <div style={{ 
                                marginTop: '8px', 
                                fontSize: '11px', 
                                color: '#666' 
                            }}>
                                Calculando... {solverProgress.completedWorkers}/{solverProgress.totalWorkers} workers
                            </div>
                        )}
                    </div>

                    <table>
                        <tbody>
                            <tr title={I18.f("TEXTURE_NAME_TITLE")}>
                                <td>{I18.f("TEXTURE_NAME")}</td>
                                <td><input ref="textureName" type="text" className="border-color-gray" defaultValue={this.packOptions.textureName} onBlur={this.onExporterPropChanged} /></td>
                                <td></td>
                            </tr>
                            <tr title={I18.f("TEXTURE_FORMAT_TITLE")}>
                                <td>{I18.f("TEXTURE_FORMAT")}</td>
                                <td>
                                    <select ref="textureFormat" className="border-color-gray" defaultValue={this.packOptions.textureFormat} onChange={this.onExporterChanged}>
                                        <option value="png">png</option>
                                        <option value="jpg">jpg</option>
                                    </select>
                                </td>
                                <td></td>
                            </tr>
                            <tr title={I18.f("REMOVE_FILE_EXT_TITLE")}>
                                <td>{I18.f("REMOVE_FILE_EXT")}</td>
                                <td><input ref="removeFileExtension" className="border-color-gray" type="checkbox" defaultChecked={this.packOptions.removeFileExtension ? "checked" : ""} onChange={this.onExporterPropChanged} /></td>
                                <td></td>
                            </tr>
                            <tr title={I18.f("PREPEND_FOLDER_TITLE")}>
                                <td>{I18.f("PREPEND_FOLDER")}</td>
                                <td><input ref="prependFolderName" className="border-color-gray" type="checkbox" defaultChecked={this.packOptions.prependFolderName ? "checked" : ""} onChange={this.onExporterPropChanged} /></td>
                                <td></td>
                            </tr>
                            <tr title={I18.f("BASE64_EXPORT_TITLE")}>
                                <td>{I18.f("BASE64_EXPORT")}</td>
                                <td><input ref="base64Export" className="border-color-gray" type="checkbox" defaultChecked={this.packOptions.base64Export ? "checked" : ""} onChange={this.onExporterPropChanged} /></td>
                                <td></td>
                            </tr>
                            <tr title={I18.f("SCALE_TITLE")}>
                                <td>{I18.f("SCALE")}</td>
                                <td><input ref="scale" type="number" min="0" className="border-color-gray" defaultValue={this.packOptions.scale} onBlur={this.onPropChanged}/></td>
                                <td></td>
                            </tr>
                            <tr title={I18.f("FILTER_TITLE")}>
                                <td>{I18.f("FILTER")}</td>
                                <td>
                                    <select ref="filter" className="border-color-gray" onChange={this.onExporterChanged} defaultValue={this.packOptions.filter}>
                                        {filters.map(node => {
                                            return (<option key={"filter-" + node.type} defaultValue={node.type}>{node.type}</option>)
                                        })}
                                    </select>
                                </td>
                                <td></td>
                            </tr>
                            <tr title={I18.f("FORMAT_TITLE")}>
                                <td>{I18.f("FORMAT")}</td>
                                <td>
                                    <select ref="exporter" className="border-color-gray" onChange={this.onExporterChanged} defaultValue={this.packOptions.exporter}>
                                    {exporters.map(node => {
                                        return (<option key={"exporter-" + node.type} defaultValue={node.type}>{node.type}</option>)
                                    })}
                                    </select>
                                </td>
                                <td>
                                    <div className="edit-btn back-800" ref="editCustomFormat" onClick={this.editCustomExporter}></div>
                                </td>
                            </tr>
                            <tr title={I18.f("FILE_NAME_TITLE")} style={{display: PLATFORM === 'web' ? '' : 'none'}}>
                                <td>{I18.f("FILE_NAME")}</td>
                                <td><input ref="fileName" className="border-color-gray" type="text" defaultValue={this.packOptions.fileName} onBlur={this.onExporterPropChanged} /></td>
                                <td></td>
                            </tr>
                            <tr title={I18.f("SAVE_PATH_TITLE")} style={{display: PLATFORM === 'electron' ? '' : 'none'}}>
                                <td>{I18.f("SAVE_PATH")}</td>
                                <td><input ref="savePath" className="border-color-gray" type="text" defaultValue={this.packOptions.savePath} onBlur={this.onExporterPropChanged} /></td>
                                <td>
                                    <div className="folder-btn back-800" onClick={this.selectSavePath}></div>
                                </td>
                            </tr>
                            <tr>
                                <td colSpan="3" className="center-align">
                                    <div className="btn back-800 border-color-gray color-white" onClick={this.startExport}>{I18.f("EXPORT")}</div>
                                </td>
                            </tr>

                            {/* Manual mode only - Width and Height fields */}
                            {manualMode && (
                                <>
                                    <tr title={I18.f("WIDTH_TITLE")}>
                                        <td>{I18.f("WIDTH")}</td>
                                        <td><input ref="width" type="number" min="0" className="border-color-gray" defaultValue={this.packOptions.width || 8192} onBlur={this.onPropChanged} onKeyDown={this.forceUpdate}/></td>
                                        <td></td>
                                    </tr>
                                    <tr title={I18.f("HEIGHT_TITLE")}>
                                        <td>{I18.f("HEIGHT")}</td>
                                        <td><input ref="height" type="number" min="0" className="border-color-gray" defaultValue={this.packOptions.height || 8192} onBlur={this.onPropChanged} onKeyDown={this.forceUpdate}/></td>
                                        <td></td>
                                    </tr>
                                </>
                            )}

                            <tr title={I18.f("PADDING_TITLE")}>
                                <td>{I18.f("PADDING")}</td>
                                <td><input ref="spritePadding" type="number" className="border-color-gray" defaultValue={this.packOptions.spritePadding} min="0" onInput={this.onPropChanged} onKeyDown={this.forceUpdate}/></td>
                                <td></td>
                            </tr>
                            <tr title={I18.f("EXTRUDE_TITLE")}>
                                <td>{I18.f("EXTRUDE")}</td>
                                <td><input ref="borderPadding" type="number" className="border-color-gray" defaultValue={this.packOptions.borderPadding} min="0" onInput={this.onPropChanged} onKeyDown={this.forceUpdate}/></td>
                                <td></td>
                            </tr>
                            <tr title={I18.f("ALLOW_ROTATION_TITLE")}>
                                <td>{I18.f("ALLOW_ROTATION")}</td>
                                <td><input ref="allowRotation" type="checkbox" className="border-color-gray" onChange={this.onPropChanged} defaultChecked={allowRotation ? "checked" : ""} disabled={exporterRotationDisabled} /></td>
                                <td></td>
                            </tr>
                            <tr title={I18.f("ALLOW_TRIM_TITLE")}>
                                <td>{I18.f("ALLOW_TRIM")}</td>
                                <td><input ref="allowTrim" type="checkbox" className="border-color-gray" onChange={this.onPropChanged} defaultChecked={allowTrim ? "checked" : ""}  disabled={exporterTrimDisabled} /></td>
                                <td></td>
                            </tr>
                            <tr title={I18.f("DETECT_IDENTICAL_TITLE")}>
                                <td>{I18.f("DETECT_IDENTICAL")}</td>
                                <td><input ref="detectIdentical" type="checkbox" className="border-color-gray" onChange={this.onPropChanged} defaultChecked={this.packOptions.detectIdentical ? "checked" : ""}/></td>
                                <td></td>
                            </tr>
                            <tr title={I18.f("PACKER_TITLE")}>
                                <td>{I18.f("PACKER")}</td>
                                <td>
                                    <select ref="packer" className="border-color-gray" onChange={this.onPackerChange} defaultValue={this.packOptions.packer}>
                                    {packers.map(node => {
                                        return (<option key={"packer-" + node.type} defaultValue={node.type}>{node.type}</option>)
                                    })}
                                    </select>
                                </td>
                                <td></td>
                            </tr>
                            <tr title={I18.f("PACKER_METHOD_TITLE")}>
                                <td>{I18.f("PACKER_METHOD")}</td>
                                <td><PackerMethods ref="packerMethod" packer={this.state.packer} defaultMethod={this.packOptions.packerMethod} handler={this.onPropChanged}/></td>
                                <td></td>
                            </tr>
                            <tr>
                                <td colSpan="3" className="center-align">
                                    Advanced
                                </td>
                            </tr>

                            <tr title={I18.f("CLEAR_STORED_ORDER_TITLE")}>
                                <td colSpan="3" className="center-align">
                                    <div className={"btn "+ (window.__sparrow_order == undefined ? "back-400" : "back-800") +" border-color-gray color-white"} onClick={this.clearOrder}>{I18.f("CLEAR_STORED_ORDER")}</div>
                                </td>
                            </tr>

                            <tr title={I18.f("SORT_EXPORT_TITLE")}>
                                <td>{I18.f("SORT_EXPORT")}</td>
                                <td><input ref="sortExportedRows" type="checkbox" className="border-color-gray" onChange={this.onPropChanged} defaultChecked={this.packOptions.sortExportedRows ? "checked" : ""} /></td>
                                <td></td>
                            </tr>

                            <tr title={I18.f("FIXED_SIZE_TITLE")}>
                                <td>{I18.f("FIXED_SIZE")}</td>
                                <td><input ref="fixedSize" type="checkbox" className="border-color-gray" onChange={this.onPropChanged} defaultChecked={this.packOptions.fixedSize ? "checked" : ""} /></td>
                                <td></td>
                            </tr>
                            <tr title={I18.f("POWER_OF_TWO_TITLE")}>
                                <td>{I18.f("POWER_OF_TWO")}</td>
                                <td><input ref="powerOfTwo" type="checkbox" className="border-color-gray" onChange={this.onPropChanged} defaultChecked={this.packOptions.powerOfTwo ? "checked" : ""} /></td>
                                <td></td>
                            </tr>
                            <tr title={I18.f("TRIM_MODE_TITLE")}>
                                <td>{I18.f("TRIM_MODE")}</td>
                                <td>
                                    <select ref="trimMode" className="border-color-gray" onChange={this.onPropChanged} defaultValue={this.packOptions.trimMode}  disabled={exporterTrimDisabled || !this.packOptions.allowTrim}>
                                        <option value="trim">trim</option>
                                        <option value="crop">crop</option>
                                    </select>
                                </td>
                                <td></td>
                            </tr>
                            <tr title={I18.f("ALPHA_THRESHOLD_TITLE")}>
                                <td>{I18.f("ALPHA_THRESHOLD")}</td>
                                <td><input ref="alphaThreshold" type="number" className="border-color-gray" defaultValue={this.packOptions.alphaThreshold} min="0" max="255" onBlur={this.onPropChanged} onKeyDown={this.forceUpdate}/></td>
                                <td></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }
}

class PackerMethods extends React.Component {
    render() {
        let packer = getPackerByType(this.props.packer);

        if(!packer) {
            throw new Error("Unknown packer " + this.props.packer);
        }

        let items = [];

        let methods = Object.keys(packer.methods);
        for(let item of methods) {
            items.push(<option value={item} key={"packer-method-" + item }>{item}</option>);
        }

        return (
            <select onChange={this.props.handler} className="border-color-gray" defaultValue={this.props.defaultMethod} >{items}</select>
        )
    }
}

export default PackProperties;
