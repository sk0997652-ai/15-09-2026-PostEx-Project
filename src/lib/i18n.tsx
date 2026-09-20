import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'en' | 'ur';

export interface Translations {
  [key: string]: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    // Top Bar & Common
    'app.title': 'PostEx Candidate Onboarding Portal',
    'app.subtitle': 'Official Digital Joining Experience',
    'common.logout': 'Sign Out',
    'common.loading': 'Loading...',
    'common.saveAndContinue': 'Save & Continue',
    'common.back': 'Back',
    'common.submit': 'Submit Application',
    'common.saving': 'Saving draft...',
    'common.savedAt': 'Draft saved at',
    'common.saveFailed': 'Autosave failed. Check connection.',
    'common.optional': '(Optional)',
    'common.required': '*',
    'common.select': 'Select option...',
    'common.viewStatus': 'View Application Status',
    'common.backToForm': 'Back to Application Form',

    // Candidate Login
    'login.title': 'Candidate Portal Login',
    'login.subtitle': 'Enter your credentials received via PostEx HR offer letter or SMS.',
    'login.joiningId': 'Joining ID',
    'login.joiningIdPlaceholder': 'e.g. PEX-2026-001',
    'login.cnic': 'CNIC Number',
    'login.cnicPlaceholder': '35201-1234567-1',
    'login.mobile': 'Mobile Number',
    'login.mobilePlaceholder': '03001234567',
    'login.sendOtp': 'Send 6-Digit OTP',
    'login.otpTitle': 'Enter Verification OTP',
    'login.otpSubtitle': 'Enter the 6-digit one-time code sent to your registered mobile.',
    'login.otpPlaceholder': 'Enter 6-digit OTP',
    'login.verifyOtp': 'Verify & Enter Portal',
    'login.resendOtp': 'Resend OTP',
    'login.expiresIn': 'Code expires in:',
    'login.attemptsLeft': 'Attempts remaining:',
    'login.testNotice': 'Development/Standby Mode SMS Stub:',

    // Consent Screen
    'consent.title': 'Consent & Data Authorization',
    'consent.subtitle': 'Please read and agree to the employment verification terms before proceeding.',
    'consent.legalNotice': 'Legal Notice & Employment Declaration',
    'consent.term1Title': 'Verification of Credentials',
    'consent.term1Desc': 'I authorize PostEx (Pvt) Ltd to verify my academic credentials, previous employment history, criminal record, and NADRA CNIC records directly or through authorized verification partners.',
    'consent.term2Title': 'Truthful Disclosure',
    'consent.term2Desc': 'I certify that all information submitted during this onboarding process is true, complete, and accurate to the best of my knowledge.',
    'consent.term3Title': 'Consequences of False Information',
    'consent.term3Desc': 'I acknowledge that any false representation, forgery, or willful concealment of material facts shall constitute immediate grounds for revocation of the job offer or termination of employment without notice, and potential legal action under Pakistani Law.',
    'consent.term4Title': 'Data Privacy & Protection',
    'consent.term4Desc': 'Your personal information is collected solely for human resources management, payroll processing, statutory compliance, and corporate security purposes.',
    'consent.check1': 'I have read and fully understood the above terms and employment declarations.',
    'consent.check2': 'I grant irrevocable consent to PostEx to perform background and credential verifications.',
    'consent.check3': 'I solemnly declare that all personal and professional details provided by me are authentic.',
    'consent.acceptButton': 'I Accept & Agree to Terms',
    'consent.mustCheckAll': 'You must accept all required checkboxes to proceed with onboarding.',

    // Welcome Screen
    'welcome.title': 'Welcome to PostEx!',
    'welcome.greeting': 'Assalam-o-Alaikum,',
    'welcome.subtitle': 'We are thrilled to welcome you to the PostEx family. Please complete your digital joining dossier so our team can prepare your workstation, contracts, and payroll.',
    'welcome.joiningDetails': 'Your Offer Summary',
    'welcome.candidateName': 'Candidate Name',
    'welcome.joiningId': 'Joining ID',
    'welcome.assignedRole': 'Assigned Role',
    'welcome.assignedBranch': 'Assigned Branch',
    'welcome.assignedZone': 'Region / Zone',
    'welcome.overviewTitle': 'What You Will Need (~7–10 minutes)',
    'welcome.req1': 'CNIC & Personal information (Date of birth, address, emergency contact)',
    'welcome.req2': 'Educational certificates & prior employment record',
    'welcome.req3': 'Next of kin & two professional or personal references',
    'welcome.autosaveNotice': 'Your progress is saved automatically at every step so you won’t lose your data.',
    'welcome.startButton': 'Begin Onboarding Wizard',
    'welcome.continueButton': 'Continue Saved Application',
    'welcome.portalHome': 'Welcome',

    // Wizard Navigation
    'wizard.step1Title': '1. About You',
    'wizard.step1Subtitle': 'Personal & contact information',
    'wizard.step2Title': '2. Education & Career',
    'wizard.step2Subtitle': 'Academic qualifications & work history',
    'wizard.step3Title': '3. Family & References',
    'wizard.step3Subtitle': 'Next of kin & character references',
    'wizard.autosaving': 'Saving draft...',
    'wizard.savedAt': 'Draft saved at',
    'wizard.autosaveFailed': 'Autosave failed. Check connection.',
    'wizard.allChangesSaved': 'All changes saved',

    // Wizard Step 1: About You
    'step1.heading': 'Step 1: Personal & Contact Information',
    'step1.subheading': 'Provide your accurate legal details matching your official CNIC document.',
    'step1.fullName': 'Full Legal Name (as per CNIC)',
    'step1.fatherHusbandName': "Father's / Husband's Name",
    'step1.cnic': 'CNIC Number',
    'step1.dob': 'Date of Birth',
    'step1.gender': 'Gender',
    'step1.genderMale': 'Male',
    'step1.genderFemale': 'Female',
    'step1.genderOther': 'Other',
    'step1.maritalStatus': 'Marital Status',
    'step1.single': 'Single',
    'step1.married': 'Married',
    'step1.divorced': 'Divorced',
    'step1.widowed': 'Widowed',
    'step1.bloodGroup': 'Blood Group',
    'step1.mobile': 'Primary Mobile Number',
    'step1.email': 'Email Address',
    'step1.emergencyPerson': 'Emergency Contact Person Name',
    'step1.emergencyRelation': 'Emergency Contact Relationship',
    'step1.emergencyPhone': 'Emergency Contact Number',
    'step1.address': 'Current Residential Address',
    'step1.city': 'City',
    'step1.province': 'Province / Domicile',
    'step1.provPunjab': 'Punjab',
    'step1.provSindh': 'Sindh',
    'step1.provKpk': 'Khyber Pakhtunkhwa',
    'step1.provBalochistan': 'Balochistan',
    'step1.provIslamabad': 'Islamabad Capital Territory',
    'step1.provAjk': 'Azad Jammu & Kashmir',
    'step1.provGb': 'Gilgit-Baltistan',

    // Wizard Step 2: Education & Career
    'step2.heading': 'Step 2: Education & Professional Background',
    'step2.subheading': 'List your highest completed academic degree and previous employment history.',
    'step2.highestEdu': 'Highest Level of Education',
    'step2.matric': 'Matriculation / O-Levels',
    'step2.inter': 'Intermediate / A-Levels / DAE',
    'step2.bachelor': "Bachelor's Degree (14-16 Years)",
    'step2.master': "Master's / MPhil (16-18 Years)",
    'step2.diploma': 'Diploma / Vocational Certification',
    'step2.degreeTitle': 'Degree Title / Major',
    'step2.degreePlaceholder': 'e.g. BS Computer Science, B.Com, FSC Pre-Eng',
    'step2.institute': 'Institute / University Name',
    'step2.gradYear': 'Passing / Graduation Year',
    'step2.totalExp': 'Total Work Experience',
    'step2.fresh': 'Fresh Graduate / No Experience',
    'step2.exp1to2': '1 to 2 Years',
    'step2.exp3to5': '3 to 5 Years',
    'step2.exp5plus': 'More than 5 Years',
    'step2.lastEmployer': 'Most Recent / Current Employer',
    'step2.lastTitle': 'Last Job Title / Designation',
    'step2.lastSalary': 'Last Monthly Salary (PKR)',
    'step2.noticePeriod': 'Notice Period / Earliest Availability',
    'step2.immediate': 'Immediate Joiner',
    'step2.notice15': '15 Days Notice',
    'step2.notice30': '30 Days Notice',

    // Wizard Step 3: Family & References
    'step3.heading': 'Step 3: Family Details & References',
    'step3.subheading': 'Specify your next of kin and provide two references who can attest to your character.',
    'step3.kinName': 'Next of Kin Full Name',
    'step3.kinRelation': 'Relationship to Next of Kin',
    'step3.kinRelationFather': 'Father',
    'step3.kinRelationMother': 'Mother',
    'step3.kinRelationSpouse': 'Spouse',
    'step3.kinRelationBrother': 'Brother',
    'step3.kinRelationSister': 'Sister',
    'step3.kinRelationOther': 'Other Relative',
    'step3.kinPhone': 'Next of Kin Mobile Number',
    'step3.dependentsCount': 'Number of Financial Dependents',
    'step3.ref1Heading': 'Reference 1 (Professional or Academic)',
    'step3.ref2Heading': 'Reference 2 (Personal or Character)',
    'step3.refName': 'Full Name',
    'step3.refOrg': 'Company / Organization / Institute',
    'step3.refDesignation': 'Designation / Relationship',
    'step3.refPhone': 'Mobile Number',
    'step3.refCity': 'City',
    'step3.submitNotice': 'Review your entries carefully. After submission, your application will be forwarded to your Branch Manager for physical document verification.',

    // Status Tracker
    'tracker.title': 'Application Status Tracker',
    'tracker.subtitle': 'Track the real-time progression of your PostEx employee onboarding.',
    'tracker.stage1Title': '1. Application Submission',
    'tracker.stage1Desc': 'Personal, academic, and reference details completed by candidate.',
    'tracker.stage2Title': '2. Branch Physical Verification',
    'tracker.stage2Desc': 'Branch Manager verifies physical documents, biometric check, and applies digital stamp.',
    'tracker.stage3Title': '3. Regional & Central HR Audit',
    'tracker.stage3Desc': 'HR compliance team verifies background check, compensation grade, and Nadra checks.',
    'tracker.stage4Title': '4. Employee Enrollment & Dossier',
    'tracker.stage4Desc': 'Official PostEx Employee ID issued and digital onboarding dossier generated.',
    'tracker.statusDraft': 'Application in Progress (Draft)',
    'tracker.statusSubmitted': 'Submitted — Pending Branch Review',
    'tracker.statusBmVerification': 'Physical Verification in Progress at Branch',
    'tracker.statusNeedsCorrection': 'Action Required: Corrections Requested',
    'tracker.statusHrReview': 'Under Review with Central HR',
    'tracker.statusApproved': 'Approved & Employee ID Issued',
    'tracker.statusRejected': 'Application Terminated / Rejected',
    'tracker.correctionNotice': 'Important: The Branch Manager or HR has requested corrections on your application. Please review the remarks below and update your details.',
    'tracker.remarksTitle': 'Correction Remarks from Reviewer:',
    'tracker.assignedBranch': 'Your Designated Branch',
    'tracker.branchAddress': 'Branch Address',
    'tracker.joiningIdBadge': 'Joining ID:',
  },
  ur: {
    // Top Bar & Common
    'app.title': 'پوسٹ ایکس امیدوار آن بورڈنگ پورٹل',
    'app.subtitle': 'سرکاری ڈیجیٹل جوائننگ تجربہ',
    'common.logout': 'لاگ آؤٹ',
    'common.loading': 'براہ کرم انتظار فرمائیں...',
    'common.saveAndContinue': 'محفوظ کریں اور آگے بڑھیں',
    'common.back': 'پیچھے جائیں',
    'common.submit': 'درخواست جمع کروائیں',
    'common.saving': 'ڈرافٹ محفوظ ہو رہا ہے...',
    'common.savedAt': 'ڈرافٹ محفوظ ہوا:',
    'common.saveFailed': 'محفوظ نہیں ہو سکا۔ انٹرنیٹ کنکشن چیک کریں۔',
    'common.optional': '(اختیاری)',
    'common.required': '*',
    'common.select': 'انتخاب کریں...',
    'common.viewStatus': 'درخواست کی موجودہ صورتحال دیکھیں',
    'common.backToForm': 'درخواست فارم پر واپس جائیں',

    // Candidate Login
    'login.title': 'امیدوار پورٹل لاگ اِن',
    'login.subtitle': 'پوسٹ ایکس ایچ آر سے موصولہ جوائننگ آئی ڈی، شناختی کارڈ اور موبائل نمبر درج کریں۔',
    'login.joiningId': 'جوائننگ آئی ڈی (Joining ID)',
    'login.joiningIdPlaceholder': 'مثلاً: PEX-2026-001',
    'login.cnic': 'قومی شناختی کارڈ نمبر (CNIC)',
    'login.cnicPlaceholder': '35201-1234567-1',
    'login.mobile': 'رجسٹرڈ موبائل نمبر',
    'login.mobilePlaceholder': '03001234567',
    'login.sendOtp': '6 ہندسوں کا او ٹی پی (OTP) بھیجیں',
    'login.otpTitle': 'تصدیقی او ٹی پی درج کریں',
    'login.otpSubtitle': 'آپ کے موبائل نمبر پر بھیجا گیا 6 ہندسوں کا کوڈ درج فرمائیں۔',
    'login.otpPlaceholder': '6 ہندسوں کا کوڈ درج کریں',
    'login.verifyOtp': 'تصدیق کریں اور پورٹل میں داخل ہوں',
    'login.resendOtp': 'دوبارہ کوڈ بھیجیں',
    'login.expiresIn': 'کوڈ کی میعاد:',
    'login.attemptsLeft': 'باقی کوششیں:',
    'login.testNotice': 'ٹیسٹنگ موڈ ایس ایم ایس کوڈ:',

    // Consent Screen
    'consent.title': 'رضامندی اور قانونی اجازت نامہ',
    'consent.subtitle': 'براہ کرم آگے بڑھنے سے پہلے ملازمت کی تصدیقی شرائط غور سے پڑھیں اور اتفاق کریں۔',
    'consent.legalNotice': 'قانونی نوٹس اور ملازمت کا حلف نامہ',
    'consent.term1Title': 'اسناد و معلومات کی تصدیق',
    'consent.term1Desc': 'میں پوسٹ ایکس (پرائیویٹ) لمیٹڈ کو اپنی تعلیمی اسناد، سابقہ ملازمت کا ریکارڈ، نادرا شناختی کارڈ اور دیگر تصدیقات خود یا مجاز اداروں کے ذریعے کروانے کی اجازت دیتا/دیتی ہوں۔',
    'consent.term2Title': 'درست معلومات کی فراہمی',
    'consent.term2Desc': 'میں حلفاً اقرار کرتا/کرتی ہوں کہ اس آن بورڈنگ کے دوران فراہم کردہ تمام معلومات میرے علم کے مطابق بالکل درست اور مکمل ہیں۔',
    'consent.term3Title': 'غلط معلومات کے قانونی نتائج',
    'consent.term3Desc': 'میں تسلیم کرتا/کرتی ہوں کہ کسی بھی جعلی دستاویز یا غلط بیانی کی صورت میں میری ملازمت فوری طور پر بغیر کسی نوٹس کے ختم کی جا سکتی ہے اور قانونی کارروائی عمل میں لائی جا سکتی ہے۔',
    'consent.term4Title': 'رازداری اور ڈیٹا کا تحفظ',
    'consent.term4Desc': 'آپ کی ذاتی معلومات صرف انتظامی، تنخواہ اور قانونی تقاضوں کی تکمیل کے لیے استعمال کی جائیں گی۔',
    'consent.check1': 'میں نے مندرجہ بالا شرائط و ضوابط کو پڑھ کر اچھی طرح سمجھ لیا ہے۔',
    'consent.check2': 'میں پوسٹ ایکس کو اپنے پس منظر اور اسناد کی مکمل تصدیق کی اجازت دیتا/دیتی ہوں۔',
    'consent.check3': 'میں حلف دیتا/دیتی ہوں کہ میری فراہم کردہ تمام معلومات اصلی اور مستند ہیں۔',
    'consent.acceptButton': 'میں تمام شرائط تسلیم کرتا/کرتی ہوں',
    'consent.mustCheckAll': 'آگے بڑھنے کے لیے تمام لازمی خانوں پر نشان لگانا ضروری ہے۔',

    // Welcome Screen
    'welcome.title': 'پوسٹ ایکس میں خوش آمدید!',
    'welcome.greeting': 'السلام علیکم،',
    'welcome.subtitle': 'ہمیں آپ کو پوسٹ ایکس فیملی میں شامل کرتے ہوئے بے حد خوشی ہے۔ برائے مہربانی اپنا ڈیجیٹل جوائننگ ڈوزیئر مکمل کریں تاکہ آپ کی تعیناتی اور تنخواہ کا عمل جلد شروع ہو سکے۔',
    'welcome.joiningDetails': 'آپ کی پیشکش کا خلاصہ',
    'welcome.candidateName': 'امیدوار کا نام',
    'welcome.joiningId': 'جوائننگ آئی ڈی',
    'welcome.assignedRole': 'عہدہ',
    'welcome.assignedBranch': 'تعینات شدہ برانچ',
    'welcome.assignedZone': 'علاقہ / زون',
    'welcome.overviewTitle': 'آپ کو کن معلومات کی ضرورت ہوگی؟ (تقریباً 7 تا 10 منٹ)',
    'welcome.req1': 'شناختی کارڈ اور ذاتی کوائف (تاریخ پیدائش، رہائشی پتہ، ہنگامی رابطہ)',
    'welcome.req2': 'تعلیمی ڈگریاں اور سابقہ ملازمت کا ریکارڈ',
    'welcome.req3': 'وارث / قریبی رشتہ دار اور دو بااعتماد افراد کے نام و فون نمبر',
    'welcome.autosaveNotice': 'آپ کی معلومات ہر قدم پر خودکار طور پر محفوظ ہوتی رہیں گی تاکہ کوئی ریکارڈ ضائع نہ ہو۔',
    'welcome.startButton': 'فارم بھرنا شروع کریں',
    'welcome.continueButton': 'محفوظ شدہ فارم جاری رکھیں',
    'welcome.portalHome': 'خوش آمدید',

    // Wizard Navigation
    'wizard.step1Title': '1. ذاتی کوائف',
    'wizard.step1Subtitle': 'نام، شناختی کارڈ اور رابطہ',
    'wizard.step2Title': '2. تعلیم اور تجربہ',
    'wizard.step2Subtitle': 'ڈگریاں اور ملازمت کا ریکارڈ',
    'wizard.step3Title': '3. فیملی اور حوالہ جات',
    'wizard.step3Subtitle': 'وارث اور 2 حوالہ جاتی افراد',
    'wizard.autosaving': 'ڈرافٹ محفوظ ہو رہا ہے...',
    'wizard.savedAt': 'ڈرافٹ محفوظ ہوا:',
    'wizard.autosaveFailed': 'محفوظ نہیں ہو سکا۔ انٹرنیٹ کنکشن چیک کریں۔',
    'wizard.allChangesSaved': 'تمام تبدیلیاں محفوظ ہیں',

    // Wizard Step 1: About You
    'step1.heading': 'مرحلہ 1: ذاتی و رہائشی معلومات',
    'step1.subheading': 'اپنے شناختی کارڈ کے عین مطابق درست تفصیلات درج فرمائیں۔',
    'step1.fullName': 'مکمل نام (شناختی کارڈ کے مطابق)',
    'step1.fatherHusbandName': 'والد / شوہر کا نام',
    'step1.cnic': 'قومی شناختی کارڈ نمبر',
    'step1.dob': 'تاریخ پیدائش',
    'step1.gender': 'جنس',
    'step1.genderMale': 'مرد',
    'step1.genderFemale': 'عورت',
    'step1.genderOther': 'دیگر',
    'step1.maritalStatus': 'ازدواجی حیثیت',
    'step1.single': 'غیر شادی شدہ',
    'step1.married': 'شادی شدہ',
    'step1.divorced': 'طلاق یافتہ',
    'step1.widowed': 'بیوہ / رنڈوا',
    'step1.bloodGroup': 'بلڈ گروپ',
    'step1.mobile': 'بنیادی موبائل نمبر',
    'step1.email': 'ای میل ایڈریس',
    'step1.emergencyPerson': 'ہنگامی رابطے کا فرد (نام)',
    'step1.emergencyRelation': 'ہنگامی فرد سے رشتہ',
    'step1.emergencyPhone': 'ہنگامی رابطے کا نمبر',
    'step1.address': 'موجودہ رہائشی پتہ',
    'step1.city': 'شہر',
    'step1.province': 'صوبہ / ڈومیسائل',
    'step1.provPunjab': 'پنجاب',
    'step1.provSindh': 'سندھ',
    'step1.provKpk': 'خیبر پختونخوا',
    'step1.provBalochistan': 'بلوچستان',
    'step1.provIslamabad': 'اسلام آباد',
    'step1.provAjk': 'آزاد کشمیر',
    'step1.provGb': 'گلگت بلتستان',

    // Wizard Step 2: Education & Career
    'step2.heading': 'مرحلہ 2: تعلیمی قابلیت اور پیشہ ورانہ تجربہ',
    'step2.subheading': 'اپنی آخری مکمل شدہ ڈگری اور سابقہ ملازمت کی تفصیلات فراہم کریں۔',
    'step2.highestEdu': 'اعلیٰ ترین تعلیمی قابلیت',
    'step2.matric': 'میٹرک / او لیول',
    'step2.inter': 'انٹر / ایف اے / ایف ایس سی / ڈی اے ای',
    'step2.bachelor': 'گریجویشن / بی اے / بی ایس سی / بی ایس (14-16 سال)',
    'step2.master': 'ماسٹرز / ایم ایس / ایم فل (16-18 سال)',
    'step2.diploma': 'ڈپلومہ / فنی سند',
    'step2.degreeTitle': 'ڈگری یا کورس کا نام',
    'step2.degreePlaceholder': 'مثلاً: بی ایس کمپیوٹر سائنس، بی کام، انٹرمیڈیٹ',
    'step2.institute': 'تعلیمی ادارے / یونیورسٹی کا نام',
    'step2.gradYear': 'فارغ التحصیل ہونے کا سال',
    'step2.totalExp': 'مجموعی کام کا تجربہ',
    'step2.fresh': 'نئے فارغ التحصیل / کوئی تجربہ نہیں',
    'step2.exp1to2': '1 تا 2 سال',
    'step2.exp3to5': '3 تا 5 سال',
    'step2.exp5plus': '5 سال سے زائد',
    'step2.lastEmployer': 'آخری یا موجودہ کمپنی / ادارہ',
    'step2.lastTitle': 'آخری عہدہ (Designation)',
    'step2.lastSalary': 'آخری ماہانہ تنخواہ (روپے)',
    'step2.noticePeriod': 'شمولیت کا ممکنہ وقت (نوٹس پیریڈ)',
    'step2.immediate': 'فوری طور پر دستیاب',
    'step2.notice15': '15 دن کا نوٹس',
    'step2.notice30': '30 دن کا نوٹس',

    // Wizard Step 3: Family & References
    'step3.heading': 'مرحلہ 3: فیملی کوائف اور دو حوالہ جات',
    'step3.subheading': 'اپنے قریبی وارث کا اندراج کریں اور دو ایسے افراد کا اندراج کریں جو آپ کے اچھے اخلاق کے ضامن ہوں۔',
    'step3.kinName': 'وارث / قریبی فرد کا نام',
    'step3.kinRelation': 'وارث سے رشتہ',
    'step3.kinRelationFather': 'والد',
    'step3.kinRelationMother': 'والدہ',
    'step3.kinRelationSpouse': 'شریک حیات',
    'step3.kinRelationBrother': 'بھائی',
    'step3.kinRelationSister': 'بہن',
    'step3.kinRelationOther': 'دیگر رشتہ دار',
    'step3.kinPhone': 'وارث کا موبائل نمبر',
    'step3.dependentsCount': 'زیر کفالت افراد کی تعداد',
    'step3.ref1Heading': 'پہلا حوالہ (پیشہ ورانہ یا تعلیمی شخصیت)',
    'step3.ref2Heading': 'دوسرا حوالہ (ذاتی یا خاندانی ضامن)',
    'step3.refName': 'مکمل نام',
    'step3.refOrg': 'کمپنی / ادارہ / پیشہ',
    'step3.refDesignation': 'عہدہ یا رشتہ',
    'step3.refPhone': 'موبائل نمبر',
    'step3.refCity': 'شہر',
    'step3.submitNotice': 'تمام اندراجات کو احتیاط سے چیک کر لیں۔ فارم جمع کروانے کے بعد یہ آپ کی برانچ میں فزیکل جانچ کے لیے بھیج دیا جائے گا۔',

    // Status Tracker
    'tracker.title': 'درخواست کی موجودہ صورتحال',
    'tracker.subtitle': 'اپنی جوائننگ اور دستاویزات کی تصدیق کا لائیو ریکارڈ دیکھیں۔',
    'tracker.stage1Title': '1. فارم کی جمع آوری',
    'tracker.stage1Desc': 'امیدوار کی جانب سے ذاتی، تعلیمی اور حوالہ جاتی تفصیلات مکمل۔',
    'tracker.stage2Title': '2. برانچ میں تصدیق',
    'tracker.stage2Desc': 'برانچ مینیجر اصل اسناد دیکھ کر تصدیقی مہر لگاتا ہے۔',
    'tracker.stage3Title': '3. زونل و سینٹرل ایچ آر آڈٹ',
    'tracker.stage3Desc': 'مرکزی ایچ آر ٹیم نادرا اور بیک گراؤنڈ چیک مکمل کرتی ہے۔',
    'tracker.stage4Title': '4. حتمی منظوری و ملازم کوڈ کا اجراء',
    'tracker.stage4Desc': 'پوسٹ ایکس ملازم کوڈ جاری اور ڈوزیئر مکمل۔',
    'tracker.statusDraft': 'فارم زیر تکمیل ہے (ڈرافٹ)',
    'tracker.statusSubmitted': 'جمع ہو چکا ہے — برانچ کی جانچ باقی ہے',
    'tracker.statusBmVerification': 'برانچ میں اصل اسناد کی جانچ جاری ہے',
    'tracker.statusNeedsCorrection': 'توجہ طلب: تصحیح کی ضرورت ہے',
    'tracker.statusHrReview': 'سینٹرل ایچ آر میں حتمی جائزے کے مراحل میں ہے',
    'tracker.statusApproved': 'منظور شدہ — ملازم آئی ڈی جاری ہو چکی ہے',
    'tracker.statusRejected': 'درخواست مسترد ہو چکی ہے',
    'tracker.correctionNotice': 'اہم اطلاع: برانچ یا ایچ آر نے فارم میں کچھ تبدیلیوں کی نشاندہی کی ہے۔ براہ کرم نیچے دیے گئے ریمارکس پڑھ کر فارم درست کریں۔',
    'tracker.remarksTitle': 'جائزہ کار کے ریمارکس:',
    'tracker.assignedBranch': 'آپ کی نامزد برانچ',
    'tracker.branchAddress': 'برانچ کا پتہ',
    'tracker.joiningIdBadge': 'جوائننگ آئی ڈی:',
  },
};

interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
  isRTL: boolean;
}

const I18nContext = createContext<I18nContextType>({
  lang: 'en',
  setLang: () => {},
  t: (k: string, fb?: string) => fb || k,
  isRTL: false,
});

const LANG_STORAGE_KEY = 'postex_candidate_lang';

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    return saved === 'ur' ? 'ur' : 'en';
  });

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem(LANG_STORAGE_KEY, newLang);
  };

  const isRTL = lang === 'ur';

  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang, isRTL]);

  const t = (key: string, fallback?: string): string => {
    const val = translations[lang]?.[key] || translations.en[key];
    if (val !== undefined && val !== null && val !== '') return val;
    if (fallback !== undefined) return fallback;
    return key;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t, isRTL }}>
      <div dir={isRTL ? 'rtl' : 'ltr'} className={isRTL ? 'font-urdu text-right' : ''}>
        {children}
      </div>
    </I18nContext.Provider>
  );
};

export const useI18n = () => useContext(I18nContext);

export const LanguageSelector: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { lang, setLang } = useI18n();

  return (
    <div className={`inline-flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-semibold ${className}`}>
      <button
        type="button"
        onClick={() => setLang('en')}
        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
          lang === 'en'
            ? 'bg-white text-indigo-700 shadow-xs font-bold'
            : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        English
      </button>
      <button
        type="button"
        onClick={() => setLang('ur')}
        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
          lang === 'ur'
            ? 'bg-white text-indigo-700 shadow-xs font-bold'
            : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        اردو
      </button>
    </div>
  );
};
