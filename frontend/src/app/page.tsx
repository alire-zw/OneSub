import AlertSquareIcon from "@/components/icons/AlertSquareIcon";
import walletStyles from "@/app/wallet/Wallet.module.css";

export default function Home() {
  return (
    <div style={{ padding: '16px', maxWidth: '700px', margin: '0 auto' }}>
      {/* محتوای صفحه از اینجا شروع می‌شود */}
      
      {/* اینفو باکس اینماد */}
      <div className={walletStyles.noteWrapper}>
        <label className={`${walletStyles.noteLabel} ${walletStyles.noteLabelInfo}`}>
          <AlertSquareIcon width={14} height={14} className={walletStyles.noteLabelIcon} color="currentColor" />
          <span>اطلاعات</span>
        </label>
        <div className={`${walletStyles.noteBox} ${walletStyles.noteBoxInfo}`}>
          <p className={walletStyles.noteText}>
            در این صفحه اینماد قرار دارد. در صورتی که آن را نمی‌بینید، طی ساعات آینده فعال خواهد شد. همچنین برای مشاهده وبسایت از navbar پایین صفحه استفاده بفرمایید.
          </p>
        </div>
      </div>

      {/* باکس اینماد */}
      <div style={{ textAlign: 'center', marginTop: '16px' }}>
        <div dangerouslySetInnerHTML={{
          __html: `<a referrerpolicy='origin' target='_blank' href='https://trustseal.enamad.ir/?id=695041&Code=Fnt03Cy8V7NzZmgLbso7NLgGOR52gfQc'><img referrerpolicy='origin' src='https://trustseal.enamad.ir/logo.aspx?id=695041&Code=Fnt03Cy8V7NzZmgLbso7NLgGOR52gfQc' alt='' style='cursor:pointer' code='Fnt03Cy8V7NzZmgLbso7NLgGOR52gfQc'></a>`
        }} />
      </div>
    </div>
  );
}
