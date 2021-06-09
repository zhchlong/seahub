import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import copy from 'copy-to-clipboard';
import moment from 'moment';
import { Button, Form, FormGroup, Label, Input, InputGroup, InputGroupAddon, InputGroupText, Alert, FormText } from 'reactstrap';
import {
  gettext,
  shareLinkPasswordMinLength,
  canSendShareLinkEmail,
  uploadLinkExpireDaysMin,
  uploadLinkExpireDaysMax,
  uploadLinkExpireDaysDefault,
  siteRoot
} from '../../utils/constants';
import { seafileAPI } from '../../utils/seafile-api';
import { Utils } from '../../utils/utils';
import UploadLink from '../../models/upload-link';
import toaster from '../toast';
import SendLink from '../send-link';
import DateTimePicker from '../date-and-time-picker';

const propTypes = {
  itemPath: PropTypes.string.isRequired,
  repoID: PropTypes.string.isRequired,
  closeShareDialog: PropTypes.func.isRequired,
};

const inputWidth = Utils.isDesktop() ? 250 : 210;

// This code is pulled out from SeafileAPI.
function createUploadLinkModified(repoID, path, password, expirationTime, format, comment) {
  var url = seafileAPI.server + '/api/v2.1/upload-links/';
  var form = new FormData();
  form.append('path', path);
  form.append('repo_id', repoID);
  if (password) {
    form.append('password', password);
  }
  if (expirationTime) {
    form.append('expiration_time', expirationTime);
  }
  if (format) {
    form.append('format', format);
  }
  if (comment) {
    form.append('comment', comment);
  }
  return seafileAPI._sendPostRequest(url, form);
}

class GenerateUploadLink extends React.Component {
  constructor(props) {
    super(props);

    this.isExpireDaysNoLimit = (uploadLinkExpireDaysMin === 0 && uploadLinkExpireDaysMax === 0 && uploadLinkExpireDaysDefault == 0);
    this.defaultExpireDays = this.isExpireDaysNoLimit ? '' : uploadLinkExpireDaysDefault;

    let expirationLimitTip = '';
    if (uploadLinkExpireDaysMin !== 0 && uploadLinkExpireDaysMax !== 0) {
      expirationLimitTip = gettext('{minDays_placeholder} - {maxDays_placeholder} days')
        .replace('{minDays_placeholder}', uploadLinkExpireDaysMin)
        .replace('{maxDays_placeholder}', uploadLinkExpireDaysMax);
    } else if (uploadLinkExpireDaysMin !== 0 && uploadLinkExpireDaysMax === 0) {
      expirationLimitTip = gettext('Greater than or equal to {minDays_placeholder} days')
        .replace('{minDays_placeholder}', uploadLinkExpireDaysMin);
    } else if (uploadLinkExpireDaysMin === 0 && uploadLinkExpireDaysMax !== 0) {
      expirationLimitTip = gettext('Less than or equal to {maxDays_placeholder} days')
        .replace('{maxDays_placeholder}', uploadLinkExpireDaysMax);
    }
    this.expirationLimitTip = expirationLimitTip;

    this.state = {
      showPasswordInput: false,
      showFormatInput: false,
      showCommentInput: false,
      passwordVisible: false,
      password: '',
      passwdnew: '',
      format: '',
      prettyPrintedFormat: '',
      comment: '',
      sharedUploadInfo: null,
      isSendLinkShown: false,
      isExpireChecked: !this.isExpireDaysNoLimit,
      setExp: 'by-days',
      expireDays: this.defaultExpireDays,
      expDate: null
    };
  }

  componentDidMount() {
    this.getUploadLink();
  }

  getUploadLink = () => {
    let path = this.props.itemPath;
    let repoID = this.props.repoID;
    seafileAPI.getUploadLink(repoID, path).then((res) => {
      if (res.data.length !== 0) {
        let sharedUploadInfo = new UploadLink(res.data[0]);
        this.setState({sharedUploadInfo: sharedUploadInfo});
      }
    }).catch((err) => {
      let errMsg = Utils.getErrorMsg(err, true);
      if (!err.response || err.response.status !== 403) {
        toaster.danger(errMsg);
      }
      this.props.closeShareDialog();
    });
  }

  addPassword = () => {
    this.setState({
      showPasswordInput: !this.state.showPasswordInput,
      password: '',
      passwdnew: '',
      errorInfo: ''
    });
  }

  addFormat = () => {
    this.setState({
      showFormatInput: !this.state.showFormatInput,
      errorInfo: ''
    });
  }

  addComment = () => {
    this.setState({
      showCommentInput: !this.state.showCommentInput,
      errorInfo: ''
    });
  }

  inputFormat = (e) => {
    this.setState({
      format: e.target.value,
      prettyPrintedFormat: e.target.value.length > 0 ? Utils.prettyPrintFormatString(e.target.value) : ''
    });
  }

  addParameter = () => {
    let newFormat = this.state.format + '{}';
    this.setState({
      format: newFormat,
      prettyPrintedFormat: Utils.prettyPrintFormatString(newFormat)
    });
  }

  inputComment = (e) => {
    this.setState({
      comment: e.target.value
    });
  }

  togglePasswordVisible = () => {
    this.setState({
      passwordVisible: !this.state.passwordVisible
    });
  }

  generatePassword = () => {
    let val = Utils.generatePassword(shareLinkPasswordMinLength);
    this.setState({
      password: val,
      passwordnew: val
    });
  }

  inputPassword = (e) => {
    this.setState({
      password: e.target.value
    });
  }

  inputPasswordNew = (e) => {
    this.setState({
      passwordnew: e.target.value
    });
  }

  generateUploadLink = () => {
    let isValid = this.validateParamsInput();
    if (isValid) {
      this.setState({errorInfo: ''});

      let { itemPath, repoID } = this.props;
      let { password, isExpireChecked, setExp, expireDays, expDate, format, comment } = this.state;

      let expirationTime = '';
      if (isExpireChecked) {
        if (setExp == 'by-days') {
          expirationTime = moment().add(parseInt(expireDays), 'days').format();
        } else {
          expirationTime = expDate.format();
        }
      }

      createUploadLinkModified(repoID, itemPath, password, expirationTime, format, comment).then((res) => {
        let sharedUploadInfo = new UploadLink(res.data);
        this.setState({sharedUploadInfo: sharedUploadInfo});
      }).catch(error => {
        let errMessage = Utils.getErrorMsg(error);
        toaster.danger(errMessage);
      });
    }
  }

  validateParamsInput = () => {
    let { showPasswordInput, password, passwordnew, isExpireChecked, setExp, expireDays, expDate, format, comment } = this.state;

    // check password params
    if (showPasswordInput) {
      if (password.length === 0) {
        this.setState({errorInfo: gettext('Please enter password')});
        return false;
      }
      if (password.length < shareLinkPasswordMinLength) {
        this.setState({errorInfo: gettext('Password is too short')});
        return false;
      }
      if (password !== passwordnew) {
        this.setState({errorInfo: gettext('Passwords don\'t match')});
        return false;
      }
    }

    if (format !== '') {
      let checkFormatRes = Utils.validateFormat(format);
      if (checkFormatRes !== '') {
        this.setState({errorInfo: checkFormatRes});
        return false;
      }
    }

    // TODO: Add checks for upload comment.

    if (isExpireChecked) {
      if (setExp == 'by-date') {
        if (!expDate) {
          this.setState({errorInfo: 'Please select an expiration time'});
          return false;
        }
        return true;
      }

      let reg = /^\d+$/;
      if (!expireDays) {
        this.setState({errorInfo: gettext('Please enter days')});
        return false;
      }
      if (!reg.test(expireDays)) {
        this.setState({errorInfo: gettext('Please enter a non-negative integer')});
        return false;
      }

      this.setState({expireDays: parseInt(expireDays)});
    }
    return true;
  }

  onExpireChecked = (e) => {
    this.setState({isExpireChecked: e.target.checked});
  }

 setExp = (e) => {
   this.setState({
     setExp: e.target.value
   });
 }

  disabledDate = (current) => {
    if (!current) {
      // allow empty select
      return false;
    }

    if (this.isExpireDaysNoLimit) {
      return current.isBefore(moment(), 'day');
    }

    const startDay = moment().add(uploadLinkExpireDaysMin, 'days');
    const endDay = moment().add(uploadLinkExpireDaysMax, 'days');
    if (uploadLinkExpireDaysMin !== 0 && uploadLinkExpireDaysMax !== 0) {
      return current.isBefore(startDay, 'day') || current.isAfter(endDay, 'day');
    } else if (uploadLinkExpireDaysMin !== 0 && uploadLinkExpireDaysMax === 0) {
      return current.isBefore(startDay, 'day');
    } else if (uploadLinkExpireDaysMin === 0 && uploadLinkExpireDaysMax !== 0) {
      return current.isBefore(moment(), 'day') || current.isAfter(endDay, 'day');
    }
  }

  onExpDateChanged = (value) => {
    this.setState({
      expDate: value
    });
  }

  onExpireDaysChanged = (e) => {
    let day = e.target.value.trim();
    this.setState({expireDays: day});
  }

  onCopyUploadLink = () => {
    let uploadLink = this.state.sharedUploadInfo.link;
    copy(uploadLink);
    toaster.success(gettext('Upload link is copied to the clipboard.'));
    this.props.closeShareDialog();
  }

  deleteUploadLink = () => {
    let sharedUploadInfo = this.state.sharedUploadInfo;
    seafileAPI.deleteUploadLink(sharedUploadInfo.token).then(() => {
      this.setState({
        showPasswordInput: false,
        showFormatInput: false,
        showCommentInput: false,
        expireDays: this.defaultExpireDays,
        isExpireChecked: !this.isExpireDaysNoLimit,
        password: '',
        passwordnew: '',
        format: '',
        prettyPrintedFormat: '',
        sharedUploadInfo: null,
      });
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  }

  toggleSendLink = () => {
    this.setState({
      isSendLinkShown: !this.state.isSendLinkShown
    });
  }

  render() {

    const { isSendLinkShown } = this.state;

    let passwordLengthTip = gettext('(at least {passwordLength} characters)');
    passwordLengthTip = passwordLengthTip.replace('{passwordLength}', shareLinkPasswordMinLength);
    if (this.state.sharedUploadInfo) {
      let sharedUploadInfo = this.state.sharedUploadInfo;
      return (
        <div>
          <Form className="mb-4">
            <FormGroup>
              <dt className="text-secondary font-weight-normal">{gettext('Upload Link:')}</dt>
              <dd className="d-flex">
                <span>{sharedUploadInfo.link}</span>
                <span className="far fa-copy action-icon" onClick={this.onCopyUploadLink}></span>
              </dd>
            </FormGroup>
            {sharedUploadInfo.expire_date && (
              <FormGroup className="mb-0">
                <dt className="text-secondary font-weight-normal">{gettext('Expiration Date:')}</dt>
                <dd>{moment(sharedUploadInfo.expire_date).format('YYYY-MM-DD HH:mm:ss')}</dd>
              </FormGroup>
            )}
            {sharedUploadInfo.format && (
              <FormGroup className="mb-0">
                <dt className="text-secondary font-weight-normal">{gettext('Filename Format:')}</dt>
                <dd>{Utils.prettyPrintFormatString(sharedUploadInfo.format)}</dd>
              </FormGroup>
            )}
            {sharedUploadInfo.comment && (
              <FormGroup className="mb-0">
                <dt className="text-secondary font-weight-normal">{gettext('Comment:')}</dt>
                <dd>{sharedUploadInfo.comment}</dd>
              </FormGroup>
            )}
          </Form>
          {canSendShareLinkEmail && !isSendLinkShown && <Button onClick={this.toggleSendLink} className="mr-2">{gettext('Send')}</Button>}
          {!isSendLinkShown && <Button onClick={this.deleteUploadLink}>{gettext('Delete')}</Button>}
          {isSendLinkShown &&
          <SendLink
            linkType='uploadLink'
            token={sharedUploadInfo.token}
            toggleSendLink={this.toggleSendLink}
            closeShareDialog={this.props.closeShareDialog}
          />
          }
        </div>
      );
    }
    return (
      <Form className="generate-upload-link">
        <FormGroup check>
          <Label check>
            <Input type="checkbox" onChange={this.addPassword} />
            <span>{gettext('Add password protection')}</span>
          </Label>
          {this.state.showPasswordInput &&
          <div className="ml-4">
            <FormGroup>
              <Label for="passwd">{gettext('Password')}</Label>
              <span className="tip">{passwordLengthTip}</span>
              <InputGroup style={{width: inputWidth}}>
                <Input id="passwd" type={this.state.passwordVisible ? 'text':'password'} value={this.state.password || ''} onChange={this.inputPassword} />
                <InputGroupAddon addonType="append">
                  <Button onClick={this.togglePasswordVisible}><i className={`link-operation-icon fas ${this.state.passwordVisible ? 'fa-eye': 'fa-eye-slash'}`}></i></Button>
                  <Button onClick={this.generatePassword}><i className="link-operation-icon fas fa-magic"></i></Button>
                </InputGroupAddon>
              </InputGroup>
            </FormGroup>
            <FormGroup>
              <Label for="passwd-again">{gettext('Password again')}</Label>
              <Input id="passwd-again" style={{width: inputWidth}} type={this.state.passwordVisible ? 'text' : 'password'} value={this.state.passwordnew || ''} onChange={this.inputPasswordNew} />
            </FormGroup>
          </div>
          }
        </FormGroup>
        <FormGroup check>
          <Label check>
            {this.isExpireDaysNoLimit ? (
              <Input type="checkbox" onChange={this.onExpireChecked} />
            ) : (
              <Input type="checkbox" checked readOnly disabled />
            )}
            <span>{gettext('Add auto expiration')}</span>
          </Label>
          {this.state.isExpireChecked &&
          <div className="ml-4">
            <FormGroup check>
              <Label check>
                <Input type="radio" name="set-exp" value="by-days" checked={this.state.setExp == 'by-days'} onChange={this.setExp} className="mr-1" />
                <span>{gettext('Expiration days')}</span>
              </Label>
              {this.state.setExp == 'by-days' && (
                <Fragment>
                  <InputGroup style={{width: inputWidth}}>
                    <Input type="text" value={this.state.expireDays} onChange={this.onExpireDaysChanged} />
                    <InputGroupAddon addonType="append">
                      <InputGroupText>{gettext('days')}</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                  {!this.state.isExpireDaysNoLimit && (
                    <FormText color="muted">{this.expirationLimitTip}</FormText>
                  )}
                </Fragment>
              )}
            </FormGroup>
            <FormGroup check>
              <Label check>
                <Input type="radio" name="set-exp" value="by-date" checked={this.state.setExp == 'by-date'} onChange={this.setExp} className="mr-1" />
                <span>{gettext('Expiration time')}</span>
              </Label>
              {this.state.setExp == 'by-date' && (
                <DateTimePicker
                  inputWidth={inputWidth}
                  disabledDate={this.disabledDate}
                  value={this.state.expDate}
                  onChange={this.onExpDateChanged}
                />
              )}
            </FormGroup>
          </div>
          }
        </FormGroup>
        <FormGroup check>
          <Label check>
            <Input type="checkbox" onChange={this.addFormat} />
            <span>{gettext('Filename auto formation')}</span>
          </Label>
          {this.state.showFormatInput &&
          <div className="ml-4">
            <FormGroup>
              <Label for="filename-format">{gettext('Filename format')}</Label>
              <InputGroup style={{width: inputWidth}}>
                <Input id="filename-format" type='text' value={this.state.format || ''} onChange={this.inputFormat} />
                <InputGroupAddon addonType="append">
                  <Button onClick={this.addParameter}><i className="link-operation-icon fas fa-plus"></i></Button>
                </InputGroupAddon>
              </InputGroup>
              <p style={{marginTop:'5px'}}>{this.state.prettyPrintedFormat}</p>
            </FormGroup>
            <p className="tip">{gettext('Filename auto formation system can automatically rename uploaded files to given format.')}<br/>{gettext('To learn basic usages, please refer to ')}<a target={'_blank'} href={`${siteRoot}help/sharing_files_and_folders/`}>{gettext('this manual')}</a></p>
          </div>
          }
        </FormGroup>
        <FormGroup check>
          <Label check>
            <Input type="checkbox" onChange={this.addComment} />
            <span>{gettext('Add upload page comment')}</span>
          </Label>
          {this.state.showCommentInput &&
          <div className="ml-4">
            <FormGroup>
              <Label for="filename-comment">{gettext('Page comment')}</Label>
              <Input id="filename-comment" style={{width: inputWidth}} type='text' onChange={this.inputComment} />
            </FormGroup>
            <p className="tip">{gettext('The comment information will be shown above the upload page.')}</p>
          </div>
          }
        </FormGroup>
        {this.state.errorInfo && <Alert color="danger" className="mt-2">{this.state.errorInfo}</Alert>}
        <Button className="generate-link-btn" onClick={this.generateUploadLink}>{gettext('Generate')}</Button>
      </Form>
    );
  }
}

GenerateUploadLink.propTypes = propTypes;

export default GenerateUploadLink;
